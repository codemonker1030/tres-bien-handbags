import React, { useState } from "react";
import { Plus, Clock, CheckCircle2, Circle, AlertCircle, Trash2 } from "lucide-react";
import { useListTasks, useCompleteTask, useDeleteTask, Task } from "@workspace/api-client";
import { useToast } from "@/hooks/use-toast";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { TaskDialog } from "@/components/dialogs/task-dialog";

export function Tasks() {
  const { toast } = useToast();
  const { data: tasks, isLoading, refetch } = useListTasks();
  const completeTask = useCompleteTask();
  const deleteTask = useDeleteTask();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const handleToggleStatus = (task: Task) => {
    if (task.status !== 'done') {
      completeTask.mutate({ id: task.id }, {
        onSuccess: () => {
          refetch();
        }
      });
    }
  };

  const handleDelete = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteTask.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Task deleted" });
        refetch();
      }
    });
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    
    if (isToday) return "Today";
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const renderPriority = (priority: string) => {
    switch (priority) {
      case 'high':
        return <Badge variant="destructive" className="px-1.5 py-0 text-[10px] uppercase font-bold tracking-wider bg-red-100 text-red-800 hover:bg-red-100 border-none">High</Badge>;
      case 'medium':
        return <Badge variant="secondary" className="px-1.5 py-0 text-[10px] uppercase font-bold tracking-wider bg-orange-100 text-orange-800 hover:bg-orange-100 border-none">Med</Badge>;
      case 'low':
        return <Badge variant="secondary" className="px-1.5 py-0 text-[10px] uppercase font-bold tracking-wider bg-slate-100 text-slate-600 hover:bg-slate-100 border-none">Low</Badge>;
      default:
        return null;
    }
  };

  const pendingTasks = tasks?.filter(t => t.status !== 'done').sort((a, b) => {
    const priorityWeight = { high: 3, medium: 2, low: 1 };
    return priorityWeight[b.priority as keyof typeof priorityWeight] - priorityWeight[a.priority as keyof typeof priorityWeight];
  }) || [];
  
  const completedTasks = tasks?.filter(t => t.status === 'done') || [];

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Tasks</h2>
          <p className="text-muted-foreground mt-1">Keep track of your daily boutique operations.</p>
        </div>
        <Button data-testid="button-add-task" onClick={() => { setEditingTask(null); setDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          Add Task
        </Button>
      </div>

      <div className="space-y-8">
        <div>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs">
              {pendingTasks.length}
            </span>
            To Do
          </h3>
          
          <div className="space-y-3">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="border-none shadow-sm">
                  <CardContent className="p-4 flex gap-3">
                    <Skeleton className="h-6 w-6 rounded-full" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-5 w-1/3" />
                      <Skeleton className="h-4 w-1/4" />
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : pendingTasks.length > 0 ? (
              pendingTasks.map((task) => (
                <Card 
                  key={task.id} 
                  className="border-none shadow-sm hover-elevate transition-all cursor-pointer group"
                  onClick={() => handleToggleStatus(task)}
                  data-testid={`task-${task.id}`}
                >
                  <CardContent className="p-4 flex items-start gap-3">
                    <button className="text-muted-foreground hover:text-primary transition-colors mt-0.5 shrink-0">
                      <Circle className="w-6 h-6" />
                    </button>
                    
                    <div className="flex-1 min-w-0" onClick={() => { setEditingTask(task); setDialogOpen(true); }}>
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-foreground truncate">{task.title}</h4>
                        {renderPriority(task.priority)}
                      </div>
                      
                      {task.description && (
                        <p className="text-sm text-muted-foreground truncate">{task.description}</p>
                      )}
                      
                      {task.dueDate && (
                        <div className={cn(
                          "flex items-center gap-1.5 text-xs mt-2 font-medium",
                          new Date(task.dueDate) < new Date() ? "text-destructive" : "text-muted-foreground"
                        )}>
                          {new Date(task.dueDate) < new Date() ? (
                            <AlertCircle className="w-3.5 h-3.5" />
                          ) : (
                            <Clock className="w-3.5 h-3.5" />
                          )}
                          {formatDate(task.dueDate)}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="text-center py-10 bg-muted/30 rounded-xl border border-dashed">
                <CheckCircle2 className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground font-medium">All caught up!</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Enjoy your day or add a new task.</p>
              </div>
            )}
          </div>
        </div>

        {completedTasks.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-4 text-muted-foreground">Completed ({completedTasks.length})</h3>
            <div className="space-y-3 opacity-60">
              {completedTasks.map((task) => (
                <Card key={task.id} className="border-none shadow-none bg-muted/50">
                  <CardContent className="p-4 flex items-start gap-3">
                    <CheckCircle2 className="w-6 h-6 text-primary shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-muted-foreground line-through">{task.title}</h4>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-auto p-1 text-muted-foreground hover:text-destructive"
                      onClick={(e) => handleDelete(task.id, e)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>

      <TaskDialog 
        open={dialogOpen} 
        onOpenChange={setDialogOpen} 
        task={editingTask} 
      />
    </div>
  );
}