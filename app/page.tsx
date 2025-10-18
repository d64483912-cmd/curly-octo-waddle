'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Zap, Settings, Trash2, Play, Download, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

interface Task {
  id: string;
  title: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: string;
}

interface Agent {
  id: string;
  goal: string;
  model: string;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'failed';
  total_tasks: number;
  completed_tasks: number;
  created_at: string;
}

const MODELS = [
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  { value: 'claude-3-haiku', label: 'Claude 3 Haiku' },
  { value: 'mistral-medium', label: 'Mistral Medium' },
  { value: 'gemini-pro', label: 'Gemini Pro (Free)' },
  { value: 'llama-3-8b', label: 'Llama 3 8B (Free)' },
];

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [defaultModel, setDefaultModel] = useState('claude-3-haiku');
  const [showSettings, setShowSettings] = useState(false);
  const [newGoal, setNewGoal] = useState('');
  const [newModel, setNewModel] = useState('claude-3-haiku');
  const { theme, setTheme } = useTheme();

  // Hydration fix
  useEffect(() => {
    setMounted(true);
    fetchAgents();
  }, []);

  // Fetch tasks when agent is selected
  useEffect(() => {
    if (selectedAgent && mounted) {
      fetchTasks(selectedAgent.id);
    }
  }, [selectedAgent, mounted]);

  const fetchAgents = async () => {
    try {
      const response = await fetch('/api/agents');
      const data = await response.json();
      setAgents(data);
    } catch (error) {
      console.error('Error fetching agents:', error);
    }
  };

  const fetchTasks = async (agentId: string) => {
    try {
      const response = await fetch(`/api/tasks?agentId=${agentId}`);
      const data = await response.json();
      setTasks(data);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    }
  };

  const createAgent = async () => {
    if (!newGoal.trim()) return;

    setLoading(true);
    try {
      const response = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal: newGoal, model: newModel }),
      });
      const newAgent = await response.json();
      setAgents([newAgent, ...agents]);
      setSelectedAgent(newAgent);
      setNewGoal('');
      setNewModel('claude-3-haiku');
    } catch (error) {
      console.error('Error creating agent:', error);
    } finally {
      setLoading(false);
    }
  };

  const runAgent = async () => {
    if (!selectedAgent) return;

    setLoading(true);
    try {
      await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: selectedAgent.id }),
      });

      // Poll for updates
      const interval = setInterval(async () => {
        await fetchAgents();
        await fetchTasks(selectedAgent.id);
      }, 1000);

      setTimeout(() => clearInterval(interval), 30000);
    } catch (error) {
      console.error('Error running agent:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteAgent = async (agentId: string) => {
    try {
      await fetch(`/api/tasks?agentId=${agentId}`, { method: 'DELETE' });
      setAgents(agents.filter(a => a.id !== agentId));
      if (selectedAgent?.id === agentId) {
        setSelectedAgent(null);
        setTasks([]);
      }
    } catch (error) {
      console.error('Error deleting agent:', error);
    }
  };

  const exportResults = () => {
    if (!selectedAgent) return;

    const markdown = `# BeastMode Report

## Goal
${selectedAgent.goal}

## Model
${selectedAgent.model}

## Timestamp
${new Date(selectedAgent.created_at).toLocaleString()}

## Tasks

${tasks.map((task, i) => `### Task ${i + 1}: ${task.title}
**Status:** ${task.status}
${task.result ? `\n${task.result}` : ''}
`).join('\n')}
`;

    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `beastmode-${selectedAgent.id}.md`;
    a.click();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500';
      case 'running':
        return 'bg-blue-500 animate-pulse';
      case 'failed':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  if (!mounted) {
    return null;
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-black/50 backdrop-blur">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="text-2xl animate-pulse">⚡</div>
            <h1 className="text-2xl font-bold">BeastMode</h1>
          </div>
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSettings(true)}
            >
              <Settings size={20} />
            </Button>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-73px)]">
        {/* Sidebar */}
        <aside className="w-64 border-r border-gray-800 bg-black/30 overflow-y-auto">
          <div className="p-4 space-y-4">
            <Dialog>
              <DialogTrigger asChild>
                <Button className="w-full bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700">
                  + New Agent
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-gray-900 border-gray-800">
                <DialogHeader>
                  <DialogTitle>Create New Agent</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Goal</label>
                    <Textarea
                      placeholder="What do you want BeastMode to accomplish?"
                      value={newGoal}
                      onChange={(e) => setNewGoal(e.target.value)}
                      className="mt-2 bg-gray-800 border-gray-700"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Model</label>
                    <Select value={newModel} onValueChange={setNewModel}>
                      <SelectTrigger className="mt-2 bg-gray-800 border-gray-700">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700">
                        {MODELS.map(m => (
                          <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    onClick={createAgent}
                    disabled={loading || !newGoal.trim()}
                    className="w-full bg-gradient-to-r from-violet-600 to-blue-600"
                  >
                    {loading ? 'Creating...' : 'Create Agent'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <div className="space-y-2">
              {agents.map(agent => (
                <div
                  key={agent.id}
                  onClick={() => setSelectedAgent(agent)}
                  className={`p-3 rounded-lg cursor-pointer transition ${
                    selectedAgent?.id === agent.id
                      ? 'bg-violet-600/20 border border-violet-500'
                      : 'bg-gray-800/50 hover:bg-gray-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{agent.goal}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {agent.completed_tasks}/{agent.total_tasks} tasks
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteAgent(agent.id);
                      }}
                      className="h-6 w-6"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                  <Badge className={`mt-2 ${getStatusColor(agent.status)}`}>
                    {agent.status}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          {selectedAgent ? (
            <div className="p-8 space-y-6">
              <div>
                <h2 className="text-3xl font-bold mb-2">{selectedAgent.goal}</h2>
                <p className="text-gray-400">Model: {selectedAgent.model}</p>
              </div>

              <div className="flex gap-4">
                <Button
                  onClick={runAgent}
                  disabled={loading || selectedAgent.status === 'running'}
                  className="bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700"
                >
                  <Play size={16} className="mr-2" />
                  {selectedAgent.status === 'running' ? 'Running...' : 'Run Agent'}
                </Button>
                <Button
                  onClick={exportResults}
                  variant="outline"
                  className="border-gray-700"
                >
                  <Download size={16} className="mr-2" />
                  Export
                </Button>
              </div>

              <div className="space-y-4">
                <h3 className="text-xl font-semibold">Tasks</h3>
                {tasks.map((task, i) => (
                  <Card key={task.id} className="bg-gray-900 border-gray-800 p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <p className="font-medium">{i + 1}. {task.title}</p>
                      </div>
                      <Badge className={getStatusColor(task.status)}>
                        {task.status}
                      </Badge>
                    </div>
                    {task.result && (
                      <div className="bg-gray-800/50 rounded p-3 text-sm text-gray-300 max-h-48 overflow-y-auto">
                        {task.result}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="text-6xl mb-4 animate-pulse">⚡</div>
                <h2 className="text-2xl font-bold mb-2">Welcome to BeastMode</h2>
                <p className="text-gray-400">Create a new agent to get started</p>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="bg-gray-900 border-gray-800">
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">OpenRouter API Key</label>
              <Input
                type="password"
                placeholder="Enter your API key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="mt-2 bg-gray-800 border-gray-700"
              />
              <p className="text-xs text-gray-400 mt-2">
                Get your key at <a href="https://openrouter.ai" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">openrouter.ai</a>
              </p>
            </div>
            <div>
              <label className="text-sm font-medium">Default Model</label>
              <Select value={defaultModel} onValueChange={setDefaultModel}>
                <SelectTrigger className="mt-2 bg-gray-800 border-gray-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  {MODELS.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => setShowSettings(false)} className="w-full">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
