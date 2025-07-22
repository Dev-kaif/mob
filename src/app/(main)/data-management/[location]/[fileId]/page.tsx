
"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { db as firebaseDB } from "@/lib/firebase";
import { ref, onValue, get } from "firebase/database";

interface FileData {
  [key: string]: any;
}

export default function ViewFilePage() {
  const params = useParams();
  const [headers, setHeaders] = useState<string[]>([]);
  const [fileData, setFileData] = useState<FileData[]>([]);
  const [fileMeta, setFileMeta] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const location = useMemo(() => {
    if (typeof params.location === 'string') {
      return decodeURIComponent(params.location);
    }
    return "";
  }, [params.location]);

  const fileId = useMemo(() => {
     if (typeof params.fileId === 'string') {
      return decodeURIComponent(params.fileId);
    }
    return "";
  }, [params.fileId]);

  useEffect(() => {
    if (!location || !fileId) return;

    const fileRef = ref(firebaseDB, `files/${location}/${fileId}`);
    const unsubscribe = onValue(fileRef, async (snapshot) => {
      const dbData = snapshot.val();
      if (dbData && dbData.content) {
        const { content, ...meta } = dbData;
        setFileMeta(meta);
        
        if(content.length > 0) {
          setHeaders(Object.keys(content[0]));
          setFileData(content);
        }
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [location, fileId]);

  const filteredData = useMemo(() => {
    if (!searchTerm) {
      return fileData;
    }
    return fileData.filter(row => 
        Object.values(row).some(value => 
            String(value).toLowerCase().includes(searchTerm.toLowerCase())
        )
    );
  }, [searchTerm, fileData]);

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-4">Loading file from Realtime Database...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
       <div className="flex items-center gap-4">
        <Button asChild variant="outline" size="icon">
          <Link href={`/data-management/${location}`}>
            <ChevronLeft className="h-4 w-4" />
            <span className="sr-only">Back</span>
          </Link>
        </Button>
        <div>
            <h1 className="text-2xl font-bold">Viewing File</h1>
            <p className="text-muted-foreground">{fileMeta?.name || 'Loading...'}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>File Content</CardTitle>
          <CardDescription>
            Displaying the data from the uploaded Excel file.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <div className="w-full max-w-sm">
                 <Input 
                    type="search" 
                    placeholder="Search in file..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                 />
            </div>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  {headers.map((header) => (
                    <TableHead key={header}>{header}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.length > 0 ? (
                  filteredData.map((row, rowIndex) => (
                    <TableRow key={rowIndex}>
                      {headers.map((header) => (
                        <TableCell key={`${rowIndex}-${header}`}>
                          {String(row[header])}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={headers.length} className="text-center">
                     {fileData.length === 0 ? "No content could be read from this file." : "No matching records found."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
