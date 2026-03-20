'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/use-toast';
import { FileText, FileDown, FolderOpen } from 'lucide-react';
import { format } from 'date-fns';

interface ClientDocumentsTableProps {
  clientOrgId: string;
}

const KIND_LABELS: Record<string, string> = {
  contract: 'Contract',
  sop: 'SOP',
  baa: 'BAA',
  coc_template: 'COC Template',
  general: 'General',
};

const KIND_COLORS: Record<string, string> = {
  contract: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  sop: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  baa: 'bg-red-500/10 text-red-600 dark:text-red-400',
  coc_template: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  general: 'bg-gray-500/10 text-gray-600 dark:text-gray-400',
};

export function ClientDocumentsTable({ clientOrgId }: ClientDocumentsTableProps) {
  const { toast } = useToast();
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDocuments() {
      try {
        const res = await fetch(`/api/clients/${clientOrgId}/documents`);
        if (res.ok) {
          const data = await res.json();
          setDocuments(data.documents || []);
        } else {
          setError('Failed to load documents');
        }
      } catch {
        setError('Failed to load documents');
      } finally {
        setLoading(false);
      }
    }

    fetchDocuments();
  }, [clientOrgId]);

  const handleDownload = async (docId: string) => {
    try {
      const res = await fetch(`/api/clients/${clientOrgId}/documents/${docId}`);
      if (res.ok) {
        const { url } = await res.json();
        window.open(url, '_blank');
      } else {
        toast({ title: 'Error', description: 'Failed to get download link', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to download document', variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        icon={FileText}
        title="Error Loading Documents"
        description={error}
      />
    );
  }

  if (documents.length === 0) {
    return (
      <EmptyState
        icon={FolderOpen}
        title="No Documents"
        description="No documents have been shared with your organization yet."
      />
    );
  }

  return (
    <Card className="p-6">
      <div className="space-y-3">
        {documents.map((doc: any) => (
          <div key={doc.id} className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{doc.fileName}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <Badge variant="secondary" className={`text-xs ${KIND_COLORS[doc.kind] || ''}`}>
                    {KIND_LABELS[doc.kind] || doc.kind}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(doc.createdAt), 'MMM d, yyyy')}
                  </span>
                  {doc.fileSize && (
                    <span className="text-xs text-muted-foreground">
                      {(doc.fileSize / 1024).toFixed(0)} KB
                    </span>
                  )}
                </div>
                {doc.notes && (
                  <p className="text-xs text-muted-foreground mt-1">{doc.notes}</p>
                )}
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="ml-4 flex-shrink-0"
              onClick={() => handleDownload(doc.id)}
            >
              <FileDown className="mr-2 h-4 w-4" />
              Download
            </Button>
          </div>
        ))}
      </div>
    </Card>
  );
}
