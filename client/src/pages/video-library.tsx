import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sidebar } from "@/components/layout/Sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  Video, Play, Download, Eye, Upload, Plus, Search, 
  Clock, Film, Trash2, Edit, MoreVertical, Calendar
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

interface VideoItem {
  id: string;
  title: string;
  description: string | null;
  category: string;
  duration: number | null;
  fileName: string;
  fileType: string;
  fileSize: number;
  storageKey: string;
  thumbnailKey: string | null;
  viewCount: number;
  downloadCount: number;
  createdAt: string;
}

const VIDEO_CATEGORIES = [
  { value: "onboarding", label: "Getting Started" },
  { value: "certificate_upload", label: "Certificate Upload" },
  { value: "extraction", label: "AI Extraction" },
  { value: "remedial_actions", label: "Remedial Actions" },
  { value: "compliance", label: "Analytics Hub" },
  { value: "admin", label: "Admin Features" },
  { value: "other", label: "Other" }
];

function formatDuration(seconds: number | null): string {
  if (!seconds) return "—";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function VideoLibrary() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [newVideo, setNewVideo] = useState({
    title: "",
    description: "",
    category: "onboarding",
    fileName: "",
    fileType: "video/mp4",
    fileSize: 0,
    storageKey: ""
  });
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: videos = [], isLoading } = useQuery<VideoItem[]>({
    queryKey: ['videos'],
    queryFn: async () => {
      const res = await fetch('/api/videos');
      if (!res.ok) throw new Error('Failed to fetch videos');
      return res.json();
    }
  });

  const createMutation = useMutation({
    mutationFn: async (video: typeof newVideo) => {
      const res = await fetch('/api/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(video)
      });
      if (!res.ok) throw new Error('Failed to create video');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['videos'] });
      setIsUploadOpen(false);
      setNewVideo({
        title: "",
        description: "",
        category: "onboarding",
        fileName: "",
        fileType: "video/mp4",
        fileSize: 0,
        storageKey: ""
      });
      toast({ title: "Video added successfully" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/videos/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete video');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['videos'] });
      toast({ title: "Video deleted" });
    }
  });

  const downloadMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/videos/${id}/download`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to track download');
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['videos'] });
      if (data.storageKey) {
        toast({ title: "Download started", description: "Your video is being downloaded." });
      }
    }
  });

  const filteredVideos = videos.filter(video => {
    const matchesSearch = video.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          video.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "all" || video.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const groupedVideos = VIDEO_CATEGORIES.reduce((acc, cat) => {
    const catVideos = filteredVideos.filter(v => v.category === cat.value);
    if (catVideos.length > 0) {
      acc.push({ category: cat.label, videos: catVideos });
    }
    return acc;
  }, [] as { category: string; videos: VideoItem[] }[]);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="p-4 md:p-8 space-y-4 md:space-y-6">
          <div className="flex justify-between items-start gap-3">
            <div>
              <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
                <Film className="w-5 h-5 md:w-7 md:h-7 text-emerald-600" />
                Video Library
              </h1>
              <p className="text-sm text-muted-foreground hidden sm:block">Demo videos and tutorials</p>
            </div>
            <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-video">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Video
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Add New Video</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input 
                      value={newVideo.title}
                      onChange={(e) => setNewVideo({...newVideo, title: e.target.value})}
                      placeholder="Getting Started with ComplianceAI"
                      data-testid="input-video-title"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea 
                      value={newVideo.description}
                      onChange={(e) => setNewVideo({...newVideo, description: e.target.value})}
                      placeholder="Learn how to upload and process compliance certificates..."
                      data-testid="input-video-description"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select 
                      value={newVideo.category}
                      onValueChange={(v) => setNewVideo({...newVideo, category: v})}
                    >
                      <SelectTrigger data-testid="select-video-category">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {VIDEO_CATEGORIES.map(cat => (
                          <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Storage Key (URL or path)</Label>
                    <Input 
                      value={newVideo.storageKey}
                      onChange={(e) => setNewVideo({...newVideo, storageKey: e.target.value, fileName: e.target.value.split('/').pop() || ''})}
                      placeholder="https://storage.example.com/videos/demo.mp4"
                      data-testid="input-video-storage-key"
                    />
                  </div>
                  <Button 
                    className="w-full" 
                    onClick={() => createMutation.mutate(newVideo)}
                    disabled={!newVideo.title || !newVideo.storageKey || createMutation.isPending}
                    data-testid="button-save-video"
                  >
                    {createMutation.isPending ? "Adding..." : "Add Video"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 sm:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search videos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-videos"
              />
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-full sm:w-48" data-testid="select-filter-category">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {VIDEO_CATEGORIES.map(cat => (
                  <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-lg p-3 md:p-4 border bg-emerald-50 dark:bg-emerald-950/40 border-l-4 border-l-emerald-500 border-emerald-200 dark:border-emerald-900">
              <div className="flex items-center gap-2 mb-1">
                <div className="p-1.5 rounded-md bg-emerald-500">
                  <Film className="h-4 w-4 text-white" />
                </div>
                <span className="text-sm font-medium text-muted-foreground">Total Videos</span>
              </div>
              <p className="text-2xl md:text-3xl font-bold text-emerald-600 dark:text-emerald-400">{videos.length}</p>
            </div>
            <div className="rounded-lg p-3 md:p-4 border bg-blue-50 dark:bg-blue-950/40 border-l-4 border-l-blue-500 border-blue-200 dark:border-blue-900">
              <div className="flex items-center gap-2 mb-1">
                <div className="p-1.5 rounded-md bg-blue-500">
                  <Eye className="h-4 w-4 text-white" />
                </div>
                <span className="text-sm font-medium text-muted-foreground">Total Views</span>
              </div>
              <p className="text-2xl md:text-3xl font-bold text-blue-600 dark:text-blue-400">{videos.reduce((sum, v) => sum + v.viewCount, 0)}</p>
            </div>
            <div className="rounded-lg p-3 md:p-4 border bg-purple-50 dark:bg-purple-950/40 border-l-4 border-l-purple-500 border-purple-200 dark:border-purple-900">
              <div className="flex items-center gap-2 mb-1">
                <div className="p-1.5 rounded-md bg-purple-500">
                  <Download className="h-4 w-4 text-white" />
                </div>
                <span className="text-sm font-medium text-muted-foreground">Downloads</span>
              </div>
              <p className="text-2xl md:text-3xl font-bold text-purple-600 dark:text-purple-400">{videos.reduce((sum, v) => sum + v.downloadCount, 0)}</p>
            </div>
            <div className="rounded-lg p-3 md:p-4 border bg-orange-50 dark:bg-orange-950/40 border-l-4 border-l-orange-500 border-orange-200 dark:border-orange-900">
              <div className="flex items-center gap-2 mb-1">
                <div className="p-1.5 rounded-md bg-orange-500">
                  <Clock className="h-4 w-4 text-white" />
                </div>
                <span className="text-sm font-medium text-muted-foreground">Categories</span>
              </div>
              <p className="text-2xl md:text-3xl font-bold text-orange-600 dark:text-orange-400">{VIDEO_CATEGORIES.length}</p>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
            </div>
          ) : filteredVideos.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <Film className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">No videos found</h3>
                <p className="text-muted-foreground mb-4">
                  {searchQuery || selectedCategory !== "all" 
                    ? "Try adjusting your search or filter" 
                    : "Add your first demo video to get started"}
                </p>
                {!searchQuery && selectedCategory === "all" && (
                  <Button onClick={() => setIsUploadOpen(true)} data-testid="button-add-first-video">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Video
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : selectedCategory === "all" ? (
            groupedVideos.map(group => (
              <div key={group.category} className="space-y-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Video className="w-5 h-5 text-emerald-600" />
                  {group.category}
                </h2>
                <div className="grid grid-cols-3 gap-4">
                  {group.videos.map(video => (
                    <VideoCard 
                      key={video.id} 
                      video={video} 
                      onDelete={() => deleteMutation.mutate(video.id)}
                      onDownload={() => downloadMutation.mutate(video.id)}
                    />
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {filteredVideos.map(video => (
                <VideoCard 
                  key={video.id} 
                  video={video} 
                  onDelete={() => deleteMutation.mutate(video.id)}
                  onDownload={() => downloadMutation.mutate(video.id)}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function VideoCard({ video, onDelete, onDownload }: { video: VideoItem; onDelete: () => void; onDownload: () => void }) {
  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow" data-testid={`card-video-${video.id}`}>
      <div className="aspect-video bg-slate-100 relative flex items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-600 to-emerald-800 opacity-90" />
        <Play className="w-12 h-12 text-white relative z-10" />
        {video.duration && (
          <Badge className="absolute bottom-2 right-2 bg-black/70 text-white text-xs">
            {formatDuration(video.duration)}
          </Badge>
        )}
      </div>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <CardTitle className="text-base line-clamp-1">{video.title}</CardTitle>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`button-video-menu-${video.id}`}>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onDownload} data-testid={`button-download-${video.id}`}>
                <Download className="h-4 w-4 mr-2" />
                Download
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete} className="text-red-600" data-testid={`button-delete-${video.id}`}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <CardDescription className="line-clamp-2 text-xs">
          {video.description || "No description"}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Eye className="h-3 w-3" />
              {video.viewCount}
            </span>
            <span className="flex items-center gap-1">
              <Download className="h-3 w-3" />
              {video.downloadCount}
            </span>
          </div>
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {new Date(video.createdAt).toLocaleDateString()}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
