
"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import {
  CloudUpload,
  FileCheck2,
  FileX2,
  FileUp,
  Loader2,
  ChevronLeft,
  Eye,
  Trash2,
} from "lucide-react";
import { useParams } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";

import { db as firebaseDB } from "@/lib/firebase";
import { ref as dbRef, onValue, set, remove, push, update } from "firebase/database";


interface UploadedFile {
    id: string;
    name: string;
    size: number;
    uploadDate: string;
    location: string;
    recordCount: number;
    content?: any[]; // Content is now optional on this list view
}

export default function ManageLocationDataPage() {
  const params = useParams();
  const { toast } = useToast();
  const location = useMemo(() => {
    if (typeof params.location === 'string') {
      return decodeURIComponent(params.location);
    }
    return "the selected location";
  }, [params.location]);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<
    "idle" | "uploading" | "success" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

  useEffect(() => {
    const filesRef = dbRef(firebaseDB, `files/${location}`);
    const unsubscribe = onValue(filesRef, (snapshot) => {
        const data = snapshot.val();
        const filesList: UploadedFile[] = [];
        if (data) {
            for (const id in data) {
                // Exclude content from the main list to save memory
                const { content, ...fileMeta } = data[id];
                filesList.push({ id, ...fileMeta });
            }
        }
        setUploadedFiles(filesList.sort((a,b) => a.name.localeCompare(b.name)));
    });

    return () => unsubscribe();
  }, [location]);


  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 20 * 1024 * 1024) { // 20MB limit
        setError("File size cannot exceed 20MB.");
        setSelectedFile(null);
      } else if (
        !file.type.includes("excel") &&
        !file.type.includes("spreadsheetml")
      ) {
        setError("Invalid file type. Please upload an .xls or .xlsx file.");
        setSelectedFile(null);
      } else {
        setSelectedFile(file);
        setError(null);
        setUploadStatus("idle");
        setUploadProgress(0);
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploadStatus("uploading");
    setUploadProgress(0);
    setError(null);
    setIsUploading(true);

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            setUploadProgress(25);
            const data = e.target?.result;
            const workbook = XLSX.read(data, { type: "array" });
            setUploadProgress(50);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            
            // CRITICAL FIX: Use `raw: true` to prevent type conversion and preserve leading zeros.
            const json = XLSX.utils.sheet_to_json(worksheet, { raw: true, defval: null });
            setUploadProgress(75);

            if (!json || json.length === 0) {
              throw new Error("The Excel file is empty or could not be read.");
            }
            
            const fileAlreadyExists = uploadedFiles.some(f => f.name === selectedFile.name);
            if (fileAlreadyExists) {
                throw new Error(`A file named "${selectedFile.name}" already exists. Please rename the file or delete the existing one.`);
            }

            const filesRef = dbRef(firebaseDB, `files/${location}`);
            const newFileRef = push(filesRef);

            const newFile = {
                id: newFileRef.key,
                name: selectedFile.name,
                size: selectedFile.size,
                uploadDate: new Date().toLocaleDateString(),
                location: location,
                recordCount: json.length, // Add record count
                content: json, // Storing content directly
            };

            await set(newFileRef, newFile);

            setUploadProgress(100);
            setUploadStatus("success");
            toast({
                title: "Upload Successful",
                description: `${selectedFile.name} has been parsed and saved.`,
            });
             setTimeout(() => {
                setSelectedFile(null);
                setUploadStatus("idle");
                setUploadProgress(0);
                setIsUploading(false);
            }, 1500);

        } catch (err: any) {
            console.error("Error processing or saving file:", err);
            setError(`Failed to parse or save the Excel file. Error: ${err.message}`);
            toast({
                variant: "destructive",
                title: "Upload Failed",
                description: err.message || "There was an error processing the file. Please ensure it is a valid Excel file.",
            });
            setUploadStatus("error");
            setIsUploading(false);
        }
    };

    reader.onerror = () => {
        console.error("FileReader error");
        setError("Failed to read file.");
        toast({
            variant: "destructive",
            title: "Upload Failed",
            description: "Could not read the selected file.",
        });
        setUploadStatus("error");
        setIsUploading(false);
    }

    reader.readAsArrayBuffer(selectedFile);
  };

  const handleDelete = async (file: UploadedFile) => {
    try {
        const fileDbRef = dbRef(firebaseDB, `files/${location}/${file.id}`);
        await remove(fileDbRef);

        toast({
            title: "File Deleted",
            description: `${file.name} has been successfully deleted.`,
        });
    } catch(e: any) {
        console.error("Failed to delete file:", e);
        toast({
            variant: "destructive",
            title: "Deletion Failed",
            description: "Could not delete the file metadata.",
        });
    }
  };

  const getStatusIcon = () => {
    switch (uploadStatus) {
      case "uploading":
        return <Loader2 className="h-6 w-6 animate-spin text-primary" />;
      case "success":
        return <FileCheck2 className="h-6 w-6 text-green-500" />;
      case "error":
        return <FileX2 className="h-6 w-6 text-destructive" />;
      default:
        return <FileUp className="h-6 w-6 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="outline" size="icon">
          <Link href="/data-management">
            <ChevronLeft className="h-4 w-4" />
            <span className="sr-only">Back</span>
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">Manage Data for {location}</h1>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <CloudUpload className="h-8 w-8 text-primary" />
            <div>
              <CardTitle className="text-2xl">Upload Files</CardTitle>
              <CardDescription>
                Upload one or more Excel files (.xls, .xlsx) for{" "}
                <span className="font-semibold text-primary">{location}</span>.
                Max file size: 20MB.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col items-center gap-4 rounded-lg border-2 border-dashed border-muted-foreground/30 p-8 text-center">
            <label
              htmlFor="file-upload"
              className="flex cursor-pointer flex-col items-center gap-2 text-muted-foreground"
            >
              <FileUp className="h-10 w-10" />
              <span className="font-semibold">
                {selectedFile ? selectedFile.name : "Click to select a file"}
              </span>
              <span className="text-xs">XLS, XLSX up to 20MB</span>
            </label>
            <Input
              id="file-upload"
              type="file"
              className="hidden"
              onChange={handleFileChange}
              accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              disabled={isUploading}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          
          {selectedFile && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 rounded-lg border p-4">
                <div className="flex-shrink-0">{getStatusIcon()}</div>
                <div className="flex-grow space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{selectedFile.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  {uploadStatus !== "idle" && (
                    <Progress value={uploadProgress} />
                  )}
                </div>
              </div>
              
              <div className="flex justify-end">
                <Button onClick={handleUpload} disabled={isUploading || uploadStatus === 'uploading'}>
                  {isUploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <CloudUpload className="mr-2 h-4 w-4" />
                      Upload File
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Uploaded Files</CardTitle>
          <CardDescription>
            A list of all uploaded Excel files for {location}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File Name</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Total Records</TableHead>
                <TableHead>Upload Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {uploadedFiles && uploadedFiles.length > 0 ? (
                uploadedFiles.map((file) => (
                  <TableRow key={file.id}>
                    <TableCell className="font-medium">{file.name}</TableCell>
                    <TableCell>
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </TableCell>
                    <TableCell>
                      {file.recordCount ?? "N/A"}
                    </TableCell>
                    <TableCell>{file.uploadDate}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="outline" size="sm" className="mr-2">
                        <Link href={`/data-management/${location}/${encodeURIComponent(file.id)}`}>
                          <Eye className="mr-2 h-4 w-4" /> View
                        </Link>
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(file)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center">
                    No files have been uploaded yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

    
