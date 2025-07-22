
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { Loader2, Users, Package, File, CheckCircle, ListTodo, PackageCheck, Hourglass, ShieldCheck } from "lucide-react";
import { db as firebaseDB } from "@/lib/firebase";
import { ref, onValue, Unsubscribe, get } from "firebase/database";
import { format } from "date-fns";
import { locations } from "@/lib/locations";
import { talukas } from "@/lib/talukas";
import { Label } from "@/components/ui/label";


interface User {
  id: string;
  name: string;
}

interface RawFile {
    name: string;
    total: number;
}

interface ProcessedRecord {
  location: string;
  taluka: string;
  bundleNo: number;
  processedBy: string;
  processedAt: string;
  sourceFile: string;
}

interface FileStat {
    name: string;
    total: number;
    completed: number;
    pending: number;
    progress: number;
}

interface UserBundleSummary {
    id: string;
    userId: string;
    userName: string;
    location: string;
    taluka: string;
    bundleNo: number;
    recordCount: number;
    isComplete: boolean;
    isForceCompleted: boolean;
}


export default function AnalyticsPage() {
  const [isLoading, setIsLoading] = useState(true);
  
  // Raw data from Firebase
  const [users, setUsers] = useState<User[]>([]);
  const [rawFiles, setRawFiles] = useState<RawFile[]>([]);
  const [processedData, setProcessedData] = useState<ProcessedRecord[]>([]);
  const [totalActiveBundles, setTotalActiveBundles] = useState(0);

  // Calculated/Derived data
  const [fileStats, setFileStats] = useState<FileStat[]>([]);
  const [allUserBundleSummary, setAllUserBundleSummary] = useState<UserBundleSummary[]>([]);
  const [totalExcelRecords, setTotalExcelRecords] = useState(0);
  
  // Filters for Bundle Summary
  const [selectedLocation, setSelectedLocation] = useState("all");
  const [selectedTaluka, setSelectedTaluka] = useState("all");
  const [availableTalukas, setAvailableTalukas] = useState<string[]>([]);

  useEffect(() => {
    const usersRef = ref(firebaseDB, 'users');
    const recordsRef = ref(firebaseDB, "processedRecords");
    const userStatesRef = ref(firebaseDB, "userStates");
    const filesRef = ref(firebaseDB, "files");

    let usersLoaded = false, recordsLoaded = false, userStatesLoaded = false, filesLoaded = false;
    
    const checkAllLoaded = () => {
        if (usersLoaded && recordsLoaded && userStatesLoaded && filesLoaded) {
            setIsLoading(false);
        }
    }

    const unsubscribeUsers = onValue(usersRef, (snapshot) => {
        const data = snapshot.val();
        setUsers(data ? Object.keys(data).map(id => ({ id, ...data[id] })) : []);
        usersLoaded = true;
        checkAllLoaded();
    });

    const unsubscribeRecords = onValue(recordsRef, (snapshot) => {
        const data = snapshot.val();
        const flattenedRecords: ProcessedRecord[] = [];
        if (data) {
            for (const location in data) {
                for (const taluka in data[location]) {
                    for (const bundleKey in data[location][taluka]) {
                         const bundleData = data[location][taluka][bundleKey];
                        // If bundleData is not a map of records but contains the forceComplete flag at the root
                        if (bundleData.isForceCompleted) continue; // We handle this separately later
                        
                        const bundleRecords = bundleData;
                        const bundleNo = parseInt(bundleKey.replace('bundle-', ''), 10);
                        
                        for (const recordId in bundleRecords) {
                             const record = bundleRecords[recordId];
                            // Skip if this is a meta-data key
                            if(typeof record !== 'object' || record === null) continue;

                            flattenedRecords.push({
                                location,
                                taluka,
                                bundleNo,
                                processedBy: record.processedBy,
                                processedAt: record.processedAt,
                                sourceFile: record.sourceFile || 'Unknown',
                            });
                        }
                    }
                }
            }
        }
        setProcessedData(flattenedRecords);
        recordsLoaded = true;
        checkAllLoaded();
    });

    const unsubscribeUserStates = onValue(userStatesRef, (snapshot) => {
        const data = snapshot.val();
        let count = 0;
        if (data) {
            count = Object.values(data).reduce((acc: number, userState: any) => acc + (userState.activeBundles ? Object.keys(userState.activeBundles).length : 0), 0);
        }
        setTotalActiveBundles(count);
        userStatesLoaded = true;
        checkAllLoaded();
    });

    const unsubscribeFiles = onValue(filesRef, (snapshot) => {
        const data = snapshot.val();
        let totalCount = 0;
        const fileList: RawFile[] = [];
        if (data) {
            for (const location in data) {
                for (const fileId in data[location]) {
                    const file = data[location][fileId];
                    // Use recordCount if available, otherwise fallback to content length for backward compatibility
                    const recordCount = file.recordCount ?? (file.content && Array.isArray(file.content) ? file.content.length : 0);
                    totalCount += recordCount;
                    fileList.push({ name: file.name, total: recordCount });
                }
            }
        }
        setRawFiles(fileList);
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

  // Recalculate stats when raw data changes
  useEffect(() => {
    // Calculate File Stats
    const processedCounts = processedData.reduce((acc: { [key: string]: number }, rec) => {
        acc[rec.sourceFile] = (acc[rec.sourceFile] || 0) + 1;
        return acc;
    }, {});
    
    const stats: FileStat[] = rawFiles.map(file => {
        const completed = processedCounts[file.name] || 0;
        return { 
            name: file.name, 
            total: file.total, 
            completed, 
            pending: file.total - completed, 
            progress: file.total > 0 ? (completed / file.total) * 100 : 0 
        };
    });
    setFileStats(stats);
    
    // Calculate User Bundle Summary
    const calculateSummary = async () => {
        const userMap = new Map(users.map((user) => [user.id, user.name]));
        
        const processedRecordsSnapshot = await get(ref(firebaseDB, 'processedRecords'));
        const allProcessedData = processedRecordsSnapshot.val() || {};

        const bundleSummaries: { [key: string]: UserBundleSummary } = {};

        if (allProcessedData) {
            for (const location in allProcessedData) {
                for (const taluka in allProcessedData[location]) {
                    for (const bundleKey in allProcessedData[location][taluka]) {
                        const bundleData = allProcessedData[location][taluka][bundleKey];
                        const bundleNo = parseInt(bundleKey.replace('bundle-', ''), 10);
                        const isForceCompleted = !!bundleData.isForceCompleted;

                        let recordsInBundle = Object.values(bundleData).filter(rec => typeof rec === 'object' && rec !== null && rec.hasOwnProperty('processedBy'));
                        let recordsCountInBundle = recordsInBundle.length;
                        
                        let userId: string | undefined = undefined;

                        // New robust logic to find the user
                        if (bundleData.forceCompletedBy && bundleData.forceCompletedBy !== 'admin') {
                            userId = bundleData.forceCompletedBy;
                        } else if (recordsInBundle.length > 0) {
                            userId = (recordsInBundle[0] as any).processedBy;
                        }
                        
                        const summaryKey = `${userId || 'admin'}-${location}-${taluka}-${bundleNo}`;
                        const isComplete = recordsCountInBundle >= 250;
                        
                        bundleSummaries[summaryKey] = {
                            id: summaryKey,
                            userId: userId || 'admin',
                            userName: userId ? (userMap.get(userId) || "Unknown User") : "N/A",
                            location: locations.find(l => l.slug === location)?.name || location,
                            taluka,
                            bundleNo,
                            recordCount: recordsCountInBundle,
                            isComplete: isComplete,
                            isForceCompleted,
                        };
                    }
                }
            }
        }
        
        const summaryList = Object.values(bundleSummaries).sort((a,b) => b.bundleNo - a.bundleNo);
        setAllUserBundleSummary(summaryList);
    };


    if (users.length > 0) {
        calculateSummary();
    }

  }, [processedData, rawFiles, users]);


  const totalPendingRecords = useMemo(() => {
    const pending = totalExcelRecords - processedData.length;
    return pending > 0 ? pending : 0;
  }, [totalExcelRecords, processedData]);


  const recordsByLocation = useMemo(() => {
    const counts: { [key: string]: number } = {};
    processedData.forEach((record) => {
      counts[record.location] = (counts[record.location] || 0) + 1;
    });
    return Object.entries(counts).map(([name, count]) => ({ name, count }));
  }, [processedData]);

  const recordsByUser = useMemo(() => {
    const counts: { [key: string]: number } = {};
    processedData.forEach((record) => {
      counts[record.processedBy] = (counts[record.processedBy] || 0) + 1;
    });
    const userMap = new Map(users.map((user) => [user.id, user.name]));
    return Object.entries(counts)
      .map(([userId, count]) => ({
        name: userMap.get(userId) || "Unknown User",
        count,
      }))
      .sort((a, b) => b.count - a.count);
  }, [processedData, users]);

  useEffect(() => {
    if (selectedLocation && selectedLocation !== 'all') {
        const foundTalukas = talukas.find(t => t.locationSlug === selectedLocation)?.talukas || [];
        setAvailableTalukas(foundTalukas);
        setSelectedTaluka("all"); // Reset taluka when location changes
    } else {
        setAvailableTalukas([]);
        setSelectedTaluka("all");
    }
  }, [selectedLocation]);
  
  const filteredUserBundleSummary = useMemo(() => {
    return allUserBundleSummary.filter(summary => {
        const locationMatch = selectedLocation === 'all' || locations.find(l => l.name === summary.location)?.slug === selectedLocation;
        const talukaMatch = selectedTaluka === 'all' || summary.taluka === selectedTaluka;
        return locationMatch && talukaMatch;
    });
  }, [allUserBundleSummary, selectedLocation, selectedTaluka]);


  const chartConfig: ChartConfig = {
    count: {
      label: "Records",
      color: "hsl(var(--primary))",
    },
  };

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-4">Loading analytics data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Excel Records</CardTitle>
            <File className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalExcelRecords}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Completed Records
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
                Total Records Pending
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

      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Processed Records by Location</CardTitle>
            <CardDescription>
              Total records processed in each location.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[250px] w-full">
              <BarChart accessibilityLayer data={recordsByLocation} layout="vertical">
                <CartesianGrid horizontal={false} />
                <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} width={150} />
                <XAxis type="number" hide />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="var(--color-count)" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
      
       <Card>
        <CardHeader>
          <CardTitle>Processing Status by Excel File</CardTitle>
          <CardDescription>
            A breakdown of record completion for each uploaded file.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File Name</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Completed</TableHead>
                <TableHead className="text-right">Pending</TableHead>
                <TableHead className="w-[200px]">Progress</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fileStats.map((file) => (
                <TableRow key={file.name}>
                  <TableCell className="font-medium">{file.name}</TableCell>
                  <TableCell className="text-right font-bold">{file.total}</TableCell>
                  <TableCell className="text-right font-bold text-green-600">{file.completed}</TableCell>
                  <TableCell className="text-right font-bold text-orange-600">{file.pending}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                        <Progress value={file.progress} className="h-2" />
                        <span className="text-xs text-muted-foreground">{Math.round(file.progress)}%</span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {fileStats.length === 0 && (
                 <TableRow>
                    <TableCell colSpan={5} className="text-center">
                        No Excel files have been uploaded yet.
                    </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>User Leaderboard</CardTitle>
          <CardDescription>
            Ranking of users by total records processed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Rank</TableHead>
                <TableHead>User Name</TableHead>
                <TableHead className="text-right">Records Processed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recordsByUser.map((user, index) => (
                <TableRow key={user.name}>
                  <TableCell className="font-medium">{index + 1}</TableCell>
                  <TableCell>{user.name}</TableCell>
                  <TableCell className="text-right font-bold">{user.count}</TableCell>
                </TableRow>
              ))}
              {recordsByUser.length === 0 && (
                 <TableRow>
                    <TableCell colSpan={3} className="text-center">
                        No records have been processed yet.
                    </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bundle Completion Summary</CardTitle>
          <CardDescription>
            A summary of which bundles have been processed by each user.
          </CardDescription>
          <div className="flex gap-4 pt-4">
            <div className="w-full max-w-xs">
                <Label htmlFor="location-filter">Filter by Location</Label>
                <Select onValueChange={setSelectedLocation} value={selectedLocation}>
                    <SelectTrigger id="location-filter">
                        <SelectValue placeholder="All Locations" />
                    </SelectTrigger>
                    <SelectContent>
                         <SelectItem value="all">All Locations</SelectItem>
                        {locations.map(loc => (
                            <SelectItem key={loc.slug} value={loc.slug}>{loc.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
             <div className="w-full max-w-xs">
                <Label htmlFor="taluka-filter">Filter by Taluka</Label>
                <Select onValueChange={setSelectedTaluka} value={selectedTaluka} disabled={selectedLocation === 'all'}>
                    <SelectTrigger id="taluka-filter">
                        <SelectValue placeholder={selectedLocation === 'all' ? "Select a location first" : "All Talukas"} />
                    </SelectTrigger>
                    <SelectContent>
                         <SelectItem value="all">All Talukas</SelectItem>
                        {availableTalukas.map(taluka => (
                            <SelectItem key={taluka} value={taluka}>{taluka}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User Name</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Taluka</TableHead>
                <TableHead>Bundle No.</TableHead>
                <TableHead className="text-center">Records Processed</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUserBundleSummary.length > 0 ? (
                filteredUserBundleSummary.map((summary) => (
                  <TableRow key={summary.id}>
                    <TableCell className="font-medium">{summary.userName}</TableCell>
                    <TableCell>{summary.location}</TableCell>
                    <TableCell>{summary.taluka}</TableCell>
                    <TableCell>#{summary.bundleNo}</TableCell>
                    <TableCell className="text-center font-bold">{summary.recordCount} / 250</TableCell>
                    <TableCell className="text-right">
                      {summary.isForceCompleted ? (
                         <Badge variant="default" className="bg-blue-600 hover:bg-blue-700">
                          <ShieldCheck className="mr-2 h-4 w-4" />
                          Complete by Admin
                        </Badge>
                      ) : summary.isComplete ? (
                        <Badge variant="default" className="bg-green-600 hover:bg-green-700">
                          <PackageCheck className="mr-2 h-4 w-4" />
                          Complete
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                           <Hourglass className="mr-2 h-4 w-4" />
                          In Progress
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center">
                    No bundle data found for the selected filters.
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
