import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, BookOpen, FileText, Scale, HelpCircle, ClipboardList, Search, RefreshCw } from "lucide-react";

interface KnowledgeDocument {
  id?: string;
  title: string;
  content: string;
  category: string;
  sourceType: 'manual' | 'legislation' | 'guidance' | 'faq' | 'procedure';
  metadata?: Record<string, any>;
}

const SOURCE_TYPE_OPTIONS = [
  { value: 'manual', label: 'Manual Entry', icon: FileText },
  { value: 'legislation', label: 'UK Legislation', icon: Scale },
  { value: 'guidance', label: 'Regulatory Guidance', icon: BookOpen },
  { value: 'faq', label: 'FAQ', icon: HelpCircle },
  { value: 'procedure', label: 'Procedure', icon: ClipboardList },
];

const CATEGORY_OPTIONS = [
  'Gas Safety',
  'Electrical Safety',
  'Fire Safety',
  'Asbestos',
  'Water Safety',
  'Lifting Equipment',
  'Building Safety',
  'Energy Performance',
  'General Compliance',
  'Platform Navigation',
];

export default function KnowledgeTrainingPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<KnowledgeDocument | null>(null);
  const [formData, setFormData] = useState<KnowledgeDocument>({
    title: '',
    content: '',
    category: 'General Compliance',
    sourceType: 'manual',
  });

  const { data: documents = [], isLoading, isFetching } = useQuery<KnowledgeDocument[]>({
    queryKey: ['/api/knowledge', categoryFilter],
    queryFn: async () => {
      const url = categoryFilter && categoryFilter !== 'all' 
        ? `/api/knowledge?category=${encodeURIComponent(categoryFilter)}`
        : '/api/knowledge';
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch documents');
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (doc: KnowledgeDocument) => {
      const res = await fetch('/api/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(doc),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to create document');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/knowledge'] });
      toast({ title: "Success", description: "Knowledge document created successfully" });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, doc }: { id: string; doc: Partial<KnowledgeDocument> }) => {
      const res = await fetch(`/api/knowledge/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(doc),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to update document');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/knowledge'] });
      toast({ title: "Success", description: "Knowledge document updated successfully" });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/knowledge/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to delete document');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/knowledge'] });
      toast({ title: "Success", description: "Knowledge document deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      title: '',
      content: '',
      category: 'General Compliance',
      sourceType: 'manual',
    });
    setEditingDoc(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (doc: KnowledgeDocument) => {
    setEditingDoc(doc);
    setFormData({
      title: doc.title,
      content: doc.content,
      category: doc.category,
      sourceType: doc.sourceType,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.title || !formData.content) {
      toast({ title: "Error", description: "Title and content are required", variant: "destructive" });
      return;
    }

    if (editingDoc?.id) {
      updateMutation.mutate({ id: editingDoc.id, doc: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this knowledge document?')) {
      deleteMutation.mutate(id);
    }
  };

  const filteredDocuments = documents.filter(doc => 
    !searchTerm || 
    doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getSourceTypeIcon = (sourceType: string) => {
    const option = SOURCE_TYPE_OPTIONS.find(o => o.value === sourceType);
    const Icon = option?.icon || FileText;
    return <Icon className="h-4 w-4" />;
  };

  return (
    <div className="flex h-screen bg-muted/30" data-testid="knowledge-training-page">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Knowledge Training" />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between gap-2 mb-2 sm:mb-0">
        <div className="hidden sm:block">
          <h1 className="text-xl md:text-2xl font-bold">Knowledge Training</h1>
          <p className="text-sm text-muted-foreground">
            Manage AI Assistant knowledge documents
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/knowledge'] })}
            disabled={isFetching}
            data-testid="button-refresh-knowledge"
            title="Refresh"
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            <span className="sm:sr-only">Refresh</span>
          </Button>
          <Button onClick={openCreateDialog} size="sm" data-testid="button-add-knowledge">
            <Plus className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Add</span>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Knowledge Base</CardTitle>
          <CardDescription className="text-sm hidden sm:block">
            Documents used by AI Assistant for semantic matching.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search knowledge documents..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-search-knowledge"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-48" data-testid="select-category-filter">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {CATEGORY_OPTIONS.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : filteredDocuments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm || categoryFilter !== 'all' 
                ? "No documents match your search criteria"
                : "No knowledge documents yet. Click 'Add Knowledge' to get started."}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDocuments.map((doc) => (
                  <TableRow key={doc.id} data-testid={`row-knowledge-${doc.id}`}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{doc.title}</div>
                        <div className="text-sm text-muted-foreground line-clamp-1">
                          {doc.content.substring(0, 100)}...
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{doc.category}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getSourceTypeIcon(doc.sourceType)}
                        <span className="text-sm">
                          {SOURCE_TYPE_OPTIONS.find(o => o.value === doc.sourceType)?.label || doc.sourceType}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(doc)}
                          data-testid={`button-edit-${doc.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => doc.id && handleDelete(doc.id)}
                          data-testid={`button-delete-${doc.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How Knowledge Training Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border rounded-lg p-4">
              <div className="font-medium mb-2">1. Add Documents</div>
              <p className="text-sm text-muted-foreground">
                Add compliance knowledge, legislation references, procedures, or FAQs that the AI should know about.
              </p>
            </div>
            <div className="border rounded-lg p-4">
              <div className="font-medium mb-2">2. Automatic Processing</div>
              <p className="text-sm text-muted-foreground">
                Documents are automatically processed and indexed for semantic search using TF-IDF embeddings.
              </p>
            </div>
            <div className="border rounded-lg p-4">
              <div className="font-medium mb-2">3. AI Retrieval</div>
              <p className="text-sm text-muted-foreground">
                When users ask questions, the AI searches this knowledge base first before using the LLM, saving costs.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingDoc ? 'Edit Knowledge Document' : 'Add Knowledge Document'}
            </DialogTitle>
            <DialogDescription>
              Add content that the AI Assistant can use to answer user questions.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., Gas Safety (Installation and Use) Regulations 1998"
                data-testid="input-knowledge-title"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="category">Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger data-testid="select-knowledge-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="sourceType">Source Type</Label>
                <Select
                  value={formData.sourceType}
                  onValueChange={(value: KnowledgeDocument['sourceType']) => 
                    setFormData({ ...formData, sourceType: value })
                  }
                >
                  <SelectTrigger data-testid="select-knowledge-source-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SOURCE_TYPE_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        <div className="flex items-center gap-2">
                          <opt.icon className="h-4 w-4" />
                          {opt.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="content">Content</Label>
              <Textarea
                id="content"
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="Enter the knowledge content. Use bullet points for clarity. Include key facts, deadlines, and requirements."
                className="min-h-[200px]"
                data-testid="textarea-knowledge-content"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Tip: Include relevant keywords, legislation references, and clear actionable information.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-save-knowledge"
            >
              {createMutation.isPending || updateMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        </main>
      </div>
    </div>
  );
}