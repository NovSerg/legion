import React, { useState, useEffect, useRef } from 'react';
import { 
  Box, 
  Button, 
  Typography, 
  List, 
  ListItem, 
  ListItemText, 
  IconButton, 
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert
} from '@mui/material';
import { Upload, Trash2, Database, RefreshCw, FileText } from 'lucide-react';
import { buildIndex } from '@/services/rag/pipeline';
import { saveIndex, loadIndex, clearIndex } from '@/services/rag/store';
import { VectorIndex } from '@/types';

interface KnowledgeManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KnowledgeManager: React.FC<KnowledgeManagerProps> = ({ isOpen, onClose }) => {
  const [index, setIndex] = useState<VectorIndex | null>(null);
  const [isIndexing, setIsIndexing] = useState(false);
  const [progress, setProgress] = useState<string>('');
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadIndexInfo = () => {
    const loaded = loadIndex();
    setIndex(loaded);
  };

  useEffect(() => {
    if (isOpen) {
      loadIndexInfo();
    }
  }, [isOpen]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const processFiles = (fileList: FileList) => {
    const newFiles: File[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (file.type === 'text/plain' || file.name.endsWith('.md') || file.name.endsWith('.json') || file.name.endsWith('.txt')) {
        newFiles.push(file);
      }
    }
    setStagedFiles((prev) => [...prev, ...newFiles]);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      processFiles(event.target.files);
    }
  };

  const handleBuildIndex = async () => {
    if (stagedFiles.length === 0) return;
    
    setIsIndexing(true);
    setProgress('Starting indexing...');
    
    try {
      const texts: string[] = [];
      const metadatas: Record<string, any>[] = [];

      for (const file of stagedFiles) {
        const text = await file.text();
        texts.push(text);
        metadatas.push({ source: file.name, type: 'file' });
      }

      const newIndex = await buildIndex(texts, metadatas, (status) => {
        setProgress(status);
      });

      saveIndex(newIndex);
      setIndex(newIndex);
      setStagedFiles([]);
      setProgress('Indexing complete!');
      setTimeout(() => setProgress(''), 3000);
    } catch (error) {
      console.error(error);
      setProgress('Error: ' + (error as Error).message);
    } finally {
      setIsIndexing(false);
    }
  };

  const handleClearIndex = () => {
    clearIndex();
    setIndex(null);
  };

  const handleExportIndex = () => {
    if (!index) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(index));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "rag_index.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  return (
    <Dialog open={isOpen} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Database size={24} />
        Knowledge Base Manager
      </DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle1">Current Index Status</Typography>
            {index && (
              <Button 
                size="small" 
                startIcon={<FileText size={16} />} 
                onClick={handleExportIndex}
              >
                Export JSON
              </Button>
            )}
          </Box>
          
          {index ? (
            <Alert severity="success" icon={<Database size={20} />}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                Ready to answer questions!
              </Typography>
              Index contains {index.documents.length} documents and {index.chunks.length} chunks.
              <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                Storage: LocalStorage (Browser)
              </Typography>
            </Alert>
          ) : (
            <Alert severity="info">No knowledge base index found.</Alert>
          )}
        </Box>

        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" gutterBottom>Add Documents</Typography>
          <Box 
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            sx={{ 
              border: '2px dashed',
              borderColor: isDragActive ? 'primary.main' : 'divider',
              borderRadius: 2,
              p: 4,
              textAlign: 'center',
              bgcolor: isDragActive ? 'action.hover' : 'background.paper',
              transition: 'all 0.2s',
              cursor: 'pointer'
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              multiple
              accept=".txt,.md,.json"
              style={{ display: 'none' }}
              ref={fileInputRef}
              onChange={handleFileUpload}
            />
            <Button variant="outlined" component="span" startIcon={<Upload />}>
              Select Files to Add
            </Button>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              or drag and drop files here (.txt, .md, .json)
            </Typography>
          </Box>
        </Box>

        {stagedFiles.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              Staged Files ({stagedFiles.length})
            </Typography>
            <List dense>
              {stagedFiles.map((file, i) => (
                <ListItem key={i} secondaryAction={
                  <IconButton edge="end" onClick={(e) => { e.stopPropagation(); setStagedFiles(stagedFiles.filter((_, idx) => idx !== i)); }}>
                    <Trash2 size={16} />
                  </IconButton>
                }>
                  <ListItemText 
                    primary={file.name} 
                    secondary={`${file.size} bytes`} 
                    sx={{ '& .MuiListItemText-primary': { display: 'flex', alignItems: 'center', gap: 1 } }}
                  />
                </ListItem>
              ))}
            </List>
            <Button 
              variant="contained" 
              fullWidth 
              onClick={handleBuildIndex} 
              disabled={isIndexing}
              startIcon={isIndexing ? <RefreshCw className="animate-spin" /> : <Database />}
            >
              {isIndexing ? 'Building Index...' : 'Build & Save Index'}
            </Button>
          </Box>
        )}

        {isIndexing && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" gutterBottom>{progress}</Typography>
            <LinearProgress />
          </Box>
        )}

        {index && index.documents.length > 0 && (
          <Box sx={{ mt: 4 }}>
            <Typography variant="h6" gutterBottom>Indexed Documents</Typography>
            <List>
              {index.documents.map((doc) => (
                <ListItem key={doc.id}>
                  <ListItemText 
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <FileText size={16} />
                        {doc.name}
                      </Box>
                    }
                    secondary={`${doc.chunks?.length || 0} chunks • ${new Date(doc.createdAt).toLocaleDateString()}`} 
                  />
                </ListItem>
              ))}
            </List>
            <Button color="error" onClick={handleClearIndex} startIcon={<Trash2 />}>
              Clear Index
            </Button>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};
