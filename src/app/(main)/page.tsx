
"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Loader2,
  Users,
  Package,
  File,
  CheckCircle,
  ListTodo,
} from "lucide-react";
import { db as firebaseDB } from "@/lib/firebase";
import { ref, onValue } from "firebase/database";

interface User {
  id: string;
  name: string;
}

interface ProcessedRecord {
  processedAt: string;
  sourceFile: string;
}

interface RawFile {
  name: string;
  total: number;
}


export default function DashboardPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [processedData, setProcessedData] = useState<ProcessedRecord[]>([]);
  const [totalActiveBundles, setTotalActiveBundles] = useState(0);
  const [totalExcelRecords, setTotalExcelRecords] = useState(0);

  useEffect(() => {
    let usersLoaded = false, recordsLoaded = false, userStatesLoaded = false, filesLoaded = false;
    
    const checkAllLoaded = () => {
        if (usersLoaded && recordsLoaded && userStatesLoaded && filesLoaded) {
            setIsLoading(false);
        }
    }

    // Fetch users from Firebase
    const usersRef = ref(firebaseDB, 'users');
    const unsubscribeUsers = onValue(usersRef, (snapshot) => {
        const data = snapshot.val();
        setUsers(data ? Object.keys(data).map(id => ({ id, ...data[id] })) : []);
        usersLoaded = true;
        checkAllLoaded();
    });

    // Fetch processedRecords from Firebase
    const processedRecordsRef = ref(firebaseDB, "processedRecords");
    const unsubscribeRecords = onValue(processedRecordsRef, (snapshot) => {
      const data = snapshot.val();
      const records: ProcessedRecord[] = [];
      if (data) {
        for (const location in data) {
          for (const taluka in data[location]) {
            for (const bundleKey in data[location][taluka]) {
              const bundleRecords = data[location][taluka][bundleKey];
              for (const recordId in bundleRecords) {
                const record = bundleRecords[recordId];
                if(typeof record !== 'object' || record === null) continue;
                records.push({
                  processedAt: record.processedAt,
                  sourceFile: record.sourceFile || 'Unknown',
                });
              }
            }
          }
        }
      }
      setProcessedData(records);
      recordsLoaded = true;
      checkAllLoaded();
    });

    // Fetch userStates for active bundles count
    const userStatesRef = ref(firebaseDB, "userStates");
    const unsubscribeUserStates = onValue(userStatesRef, (snapshot) => {
      const data = snapshot.val();
      let count = 0;
      if (data) {
        for (const userId in data) {
          if (data[userId].activeBundles) {
            count += Object.keys(data[userId].activeBundles).length;
          }
        }
      }
      setTotalActiveBundles(count);
      userStatesLoaded = true;
      checkAllLoaded();
    });

    // Fetch total records from all uploaded Excel files
    const filesRef = ref(firebaseDB, "files");
    const unsubscribeFiles = onValue(filesRef, (snapshot) => {
      const data = snapshot.val();
      let totalCount = 0;
      if (data) {
        for (const location in data) {
          for (const fileId in data[location]) {
            const file = data[location][fileId];
            const recordCount = file.recordCount ?? (file.content && Array.isArray(file.content) ? file.content.length : 0);
            totalCount += recordCount;
          }
        }
      }
      setTotalExcelRecords(totalCount);
      filesLoaded = true;
      checkAllLoaded();
    });

    return () => {
      unsubscribeUsers();
      unsubscribeRecords();
      unsubscribeUserStates();
      unsubscribeFiles();
    };
  }, []);

  const totalPendingRecords = useMemo(() => {
    const pending = totalExcelRecords - processedData.length;
    return pending > 0 ? pending : 0;
  }, [totalExcelRecords, processedData.length]);
  
  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-4">Loading dashboard data...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Excel Records
            </CardTitle>
            <File className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalExcelRecords}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Completed Records
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{processedData.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Pending Records
            </CardTitle>
            <ListTodo className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPendingRecords}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Registered Users
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Bundles</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalActiveBundles}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
