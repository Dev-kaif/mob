
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import {
  Database,
  Search,
  ChevronRight,
  RefreshCw,
  DatabaseZap,
  Download,
  AlertTriangle,
  Loader2,
  BookUser,
  PackageCheck,
  TrendingUp,
  ShieldCheck,
} from "lucide-react";
import { locations } from "@/lib/locations";
import { useToast } from "@/hooks/use-toast";
import { ref, get, remove, set, onValue, update, runTransaction } from "firebase/database";
import { db as firebaseDB } from "@/lib/firebase";
import * as XLSX from "xlsx";
import { talukas } from "@/lib/talukas";

interface User {
  id: string;
  name: string;
  username: string;
  mobile: string;
  location: string;
  excelFile: string;
}

interface ActiveBundle {
  taluka: string;
  count: number;
  bundleNo: number;
}
interface ActiveBundles {
    [taluka: string]: ActiveBundle;
}

interface BundleCounter {
    nextBundle: number;
    gaps?: number[];
}

interface BundleCounters {
    [location: string]: {
        [taluka: string]: BundleCounter;
    };
}

interface UserState {
    activeBundles?: ActiveBundles;
}

interface UserStates {
    [userId: string]: UserState;
}

export default function DataManagementPage() {
  const { toast } = useToast();
  const [downloadLocation, setDownloadLocation] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  
  // States for user progress reset
  const [userToReset, setUserToReset] = useState<string>("");
  const [talukaToReset, setTalukaToReset] = useState<string>("");
  const [availableResetTalukas, setAvailableResetTalukas] = useState<string[]>([]);
  const [isResetting, setIsResetting] = useState(false);
  
  // Mark as Complete States
  const [userToComplete, setUserToComplete] = useState<string>("");
  const [talukaToComplete, setTalukaToComplete] = useState<string>("");
  const [bundleNoToComplete, setBundleNoToComplete] = useState("");
  const [availableCompleteTalukas, setAvailableCompleteTalukas] = useState<string[]>([]);
  const [isMarkingComplete, setIsMarkingComplete] = useState(false);

  // Mark Incomplete Bundle as Complete States
  const [userToMark, setUserToMark] = useState<string>("");
  const [talukaToMark, setTalukaToMark] = useState<string>("");
  const [activeBundlesForUser, setActiveBundlesForUser] = useState<ActiveBundle[]>([]);
  const [bundleNoToDisplay, setBundleNoToDisplay] = useState<string>("N/A");
  const [isMarkingIncomplete, setIsMarkingIncomplete] = useState(false);

  // Manual Re-assign States
  const [userToReassign, setUserToReassign] = useState<string>("");
  const [talukaToReassign, setTalukaToReassign] = useState<string>("");
  const [bundleToReassign, setBundleToReassign] = useState("");
  const [availableReassignTalukas, setAvailableReassignTalukas] = useState<string[]>([]);
  const [isReassigning, setIsReassigning] = useState(false);

  // Danger Zone states
  const [isResettingAllData, setIsResettingAllData] = useState(false);
  const [isResettingAllCounters, setIsResettingAllCounters] = useState(false);
  const [dangerZonePassword, setDangerZonePassword] = useState("");

  const [bundleCounters, setBundleCounters] = useState<BundleCounters>({});
  const [userStates, setUserStates] = useState<UserStates>({});

  useEffect(() => {
    // Fetch users from Firebase
    const usersRef = ref(firebaseDB, 'users');
    const unsubscribeUsers = onValue(usersRef, (snapshot) => {
        const data = snapshot.val();
        const usersList: User[] = [];
        if (data) {
            for (const id in data) {
                usersList.push({ id, ...data[id] });
            }
        }
        setAllUsers(usersList);
    });

    // Fetch bundle counters
    const countersRef = ref(firebaseDB, 'bundleCounters');
    const unsubscribeCounters = onValue(countersRef, (snapshot) => {
        setBundleCounters(snapshot.val() || {});
    });

    // Fetch all user states
    const userStatesRef = ref(firebaseDB, 'userStates');
    const unsubscribeUserStates = onValue(userStatesRef, (snapshot) => {
        setUserStates(snapshot.val() || {});
    });


    return () => {
        unsubscribeUsers();
        unsubscribeCounters();
        unsubscribeUserStates();
    }
  }, []);

  const getTalukasForUser = (userId: string, setter: React.Dispatch<React.SetStateAction<string[]>>) => {
      if (!userId) {
          setter([]);
          return;
      }
      const selectedUser = allUsers.find(u => u.id === userId);
      if (selectedUser && selectedUser.location) {
          const userTalukas = talukas.find(t => t.locationSlug === selectedUser.location)?.talukas || [];
          setter(userTalukas);
      } else {
        setter([]);
      }
  };

  useEffect(() => {
    getTalukasForUser(userToComplete, setAvailableCompleteTalukas);
    setTalukaToComplete("");
  }, [userToComplete, allUsers]);

  useEffect(() => {
    getTalukasForUser(userToReset, setAvailableResetTalukas);
    setTalukaToReset("");
  }, [userToReset, allUsers]);

  useEffect(() => {
    getTalukasForUser(userToReassign, setAvailableReassignTalukas);
    setTalukaToReassign("");
  }, [userToReassign, allUsers]);

  useEffect(() => {
    if (userToMark && userStates[userToMark]?.activeBundles) {
        const bundles = Object.values(userStates[userToMark].activeBundles!);
        setActiveBundlesForUser(bundles);
    } else {
        setActiveBundlesForUser([]);
    }
    setTalukaToMark("");
    setBundleNoToDisplay("N/A");
  }, [userToMark, userStates]);

  useEffect(() => {
    if (talukaToMark) {
        const selectedBundle = activeBundlesForUser.find(b => b.taluka === talukaToMark);
        setBundleNoToDisplay(selectedBundle ? String(selectedBundle.bundleNo) : "N/A");
    } else {
        setBundleNoToDisplay("N/A");
    }
  }, [talukaToMark, activeBundlesForUser]);


  const handleDownload = async () => {
    if (!downloadLocation) {
      toast({
        variant: "destructive",
        title: "Please select a location",
      });
      return;
    }
    setIsDownloading(true);
    toast({
      title: "Preparing Download",
      description: "Fetching processed records from the server...",
    });

    try {
      const processedRecordsRef = ref(firebaseDB, `processedRecords/${downloadLocation}`);
      const snapshot = await get(processedRecordsRef);

      if (!snapshot.exists()) {
        toast({
          variant: "destructive",
          title: "No Data Found",
          description: "No processed records found for the selected location.",
        });
        setIsDownloading(false);
        return;
      }

      const allRecords: any[] = [];
      const data = snapshot.val();

      const userMap = new Map(allUsers.map(user => [user.id, user]));

      for (const taluka in data) {
        for (const bundle in data[taluka]) {
          const records = data[taluka][bundle];
          for (const recordId in records) {
             const record = records[recordId];
             if(typeof record !== 'object' || record === null) continue; // Skip metadata like isForceCompleted
             const user = userMap.get(record.processedBy);

             const processedRecord = {
                 ...record,
                 processedBy_userName: user?.name || record.processedBy,
                 processedBy_mobile: user?.mobile || 'N/A',
             };
            // remove original processedBy id
            delete processedRecord.processedBy;
            allRecords.push(processedRecord);
          }
        }
      }
      
      if (allRecords.length === 0) {
         toast({
          variant: "destructive",
          title: "No Records",
          description: "No processed records available for download.",
        });
        setIsDownloading(false);
        return;
      }

      const worksheet = XLSX.utils.json_to_sheet(allRecords);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Processed Records");

      const today = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(workbook, `${downloadLocation}-processed-records-${today}.xlsx`);

      toast({
        title: "Download Ready",
        description: `Successfully exported ${allRecords.length} records.`,
      });

    } catch (error) {
      console.error("Failed to download processed records:", error);
      toast({
        variant: "destructive",
        title: "Download Failed",
        description: "An error occurred while fetching or processing data.",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleResetUserProgress = async () => {
    if (!userToReset || !talukaToReset) {
      toast({ variant: "destructive", title: "Please select a user and a taluka" });
      return;
    }
    setIsResetting(true);
    const selectedUser = allUsers.find(u => u.id === userToReset);
    toast({ title: "Resetting User Progress...", description: `Scanning records for ${selectedUser?.name} in ${talukaToReset}.` });

    try {
        const selectedLocation = selectedUser?.location;
        if (!selectedLocation) {
            throw new Error("User location not found.");
        }
        
        const userStateRef = ref(firebaseDB, `userStates/${userToReset}/activeBundles/${talukaToReset}`);
        const userStateSnapshot = await get(userStateRef);
        
        if (!userStateSnapshot.exists()) {
            toast({ variant: "destructive", title: "Reset Not Needed", description: "User has no active bundle for this Taluka." });
            setIsResetting(false);
            return;
        }

        const activeBundleInfo: ActiveBundle = userStateSnapshot.val();
        const bundleNo = activeBundleInfo.bundleNo; // This is the number to recycle

        let deletedCount = 0;
        const updates: { [key: string]: null | object } = {};

        const bundleRecordsRef = ref(firebaseDB, `processedRecords/${selectedLocation}/${talukaToReset}/bundle-${bundleNo}`);
        const snapshot = await get(bundleRecordsRef);

        if (snapshot.exists()) {
            const records = snapshot.val();
             for (const recordId in records) {
                if (records[recordId].processedBy === userToReset) {
                    updates[`/processedRecords/${selectedLocation}/${talukaToReset}/bundle-${bundleNo}/${recordId}`] = null;
                    deletedCount++;
                }
            }
        }
        
        // Reset the user's bundle state for that taluka on the server
        updates[`/userStates/${userToReset}/activeBundles/${talukaToReset}`] = null;
        
        // Recycle the bundle number by adding it to the 'gaps' list for that taluka
        const bundleCounterRef = ref(firebaseDB, `bundleCounters/${selectedLocation}/${talukaToReset}`);
        await runTransaction(bundleCounterRef, (currentData) => {
            if (currentData) {
                if (!currentData.gaps) {
                    currentData.gaps = [];
                }
                // Ensure the bundle number is not already in the gaps list
                if (!currentData.gaps.includes(bundleNo)) {
                    currentData.gaps.push(bundleNo);
                }
            }
            return currentData;
        });

        // Create a signal for the user's device to clear its local state
        updates[`/userStateResets/${userToReset}/${talukaToReset}`] = {
            resetAt: new Date().toISOString()
        };
        
        if (Object.keys(updates).length > 0) {
            await update(ref(firebaseDB), updates);
        }
        
        toast({
            title: "Reset Complete",
            description: `Successfully deleted ${deletedCount} records, recycled bundle #${bundleNo}, and sent a reset signal to ${selectedUser?.name} for ${talukaToReset}.`,
        });

    } catch (error: any) {
        console.error("Failed to reset user progress:", error);
        toast({
            variant: "destructive",
            title: "Reset Failed",
            description: `An error occurred while deleting user data: ${error.message}`,
        });
    } finally {
        setIsResetting(false);
        setUserToReset("");
        setTalukaToReset("");
    }
  };

  const handleMarkAsComplete = async () => {
    if (!userToComplete || !talukaToComplete || !bundleNoToComplete) {
      toast({ variant: "destructive", title: "Please select a user, taluka, and enter a bundle number." });
      return;
    }
    const selectedUser = allUsers.find(u => u.id === userToComplete);
    if (!selectedUser) {
        toast({ variant: "destructive", title: "User not found" });
        return;
    }

    setIsMarkingComplete(true);
    toast({ title: "Processing Request...", description: `Marking bundle #${bundleNoToComplete} as complete.` });

    try {
      const locationSlug = selectedUser.location;
      const bundleNumber = parseInt(bundleNoToComplete, 10);
      if (isNaN(bundleNumber)) {
        toast({ variant: "destructive", title: "Invalid Bundle Number" });
        setIsMarkingComplete(false);
        return;
      }

      // Path to the specific bundle in processedRecords
      const bundleRef = ref(firebaseDB, `processedRecords/${locationSlug}/${talukaToComplete}/bundle-${bundleNumber}`);

      const updates: { [key: string]: any } = {};
      updates[`${bundleRef.path}/isForceCompleted`] = true;
      updates[`${bundleRef.path}/forceCompletedBy`] = "admin"; // Changed to admin ID for clarity

      // Also remove it from the user's active bundles if it's there
      updates[`/userStates/${userToComplete}/activeBundles/${talukaToComplete}`] = null;
      
      await update(ref(firebaseDB), updates);
      
      toast({
        title: "Bundle Marked as Complete",
        description: `Bundle #${bundleNumber} for ${talukaToComplete} is now marked as complete by admin.`,
      });

    } catch (error) {
      console.error("Failed to mark as complete:", error);
      toast({
        variant: "destructive",
        title: "Action Failed",
        description: "An error occurred while communicating with the server.",
      });
    } finally {
      setIsMarkingComplete(false);
      setUserToComplete("");
      setTalukaToComplete("");
      setBundleNoToComplete("");
    }
  };

  const handleManualReassign = async () => {
    if (!userToReassign || !talukaToReassign || !bundleToReassign) {
      toast({ variant: "destructive", title: "Please select a user, taluka, and enter a bundle number." });
      return;
    }
    setIsReassigning(true);
    const selectedUser = allUsers.find(u => u.id === userToReassign);
    toast({ title: "Assigning Bundle...", description: `Manually assigning bundle #${bundleToReassign} to ${selectedUser?.name}.`});

    try {
        const bundleNumber = parseInt(bundleToReassign, 10);
        if (isNaN(bundleNumber) || bundleNumber <= 0) {
            toast({ variant: "destructive", title: "Invalid Bundle Number" });
            setIsReassigning(false);
            return;
        }

        const newBundle = {
            taluka: talukaToReassign,
            count: 0,
            bundleNo: bundleNumber,
        };

        const updates: { [key: string]: any } = {};
        updates[`/userStates/${userToReassign}/activeBundles/${talukaToReassign}`] = newBundle;
        updates[`/userStateResets/${userToReassign}/${talukaToReassign}`] = {
            resetAt: new Date().toISOString(),
            type: 'manual_assign'
        };
        
        await update(ref(firebaseDB), updates);
        
        toast({
            title: "Manual Assignment Successful",
            description: `Bundle #${bundleNumber} has been assigned to ${selectedUser?.name} for ${talukaToReassign}. Their device will update shortly.`,
        });

    } catch (error: any) {
        console.error("Failed to manually reassign bundle:", error);
        toast({
            variant: "destructive",
            title: "Assignment Failed",
            description: `An error occurred: ${error.message}`,
        });
    } finally {
        setIsReassigning(false);
        setUserToReassign("");
        setTalukaToReassign("");
        setBundleToReassign("");
    }
};

  const handleResetAllProcessedData = async () => {
    if (dangerZonePassword !== "7532") {
      toast({ variant: "destructive", title: "Incorrect Password" });
      setDangerZonePassword("");
      return;
    }
    setIsResettingAllData(true);
    toast({ title: "Operation in Progress", description: "Deleting all processed data from the server..." });

    try {
        const processedRecordsRef = ref(firebaseDB, 'processedRecords');
        await remove(processedRecordsRef);
        toast({ title: "Success", description: "All processed data has been permanently deleted." });
    } catch (error) {
        console.error("Failed to delete all processed data:", error);
        toast({ variant: "destructive", title: "Operation Failed", description: "Could not delete all processed data." });
    } finally {
        setIsResettingAllData(false);
        setDangerZonePassword("");
    }
  };

  const handleResetAllIdCounters = async () => {
    if (dangerZonePassword !== "7532") {
      toast({ variant: "destructive", title: "Incorrect Password" });
      setDangerZonePassword("");
      return;
    }
    setIsResettingAllCounters(true);
    toast({ title: "Operation in Progress", description: "Resetting all bundle counters and user states..." });

    try {
        const bundleCountersRef = ref(firebaseDB, 'bundleCounters');
        const userStatesRef = ref(firebaseDB, 'userStates');
        
        await Promise.all([
            remove(bundleCountersRef),
            remove(userStatesRef)
        ]);

        toast({ title: "Success", description: "All bundle counters and user states have been reset." });
    } catch (error) {
        console.error("Failed to reset counters:", error);
        toast({ variant: "destructive", title: "Operation Failed", description: "Could not reset all counters and states." });
    } finally {
        setIsResettingAllCounters(false);
        setDangerZonePassword("");
    }
  };

    const handleMarkIncompleteAsComplete = async () => {
        if (!userToMark || !talukaToMark) {
            toast({ variant: "destructive", title: "Please select a user and a taluka." });
            return;
        }

        setIsMarkingIncomplete(true);
        toast({ title: "Processing...", description: "Marking bundle as complete." });

        try {
            const userStateRef = ref(firebaseDB, `userStates/${userToMark}/activeBundles/${talukaToMark}`);
            await remove(userStateRef);
            toast({
                title: "Success",
                description: `The active bundle for ${talukaToMark} has been marked as complete. The user can now assign a new one.`,
            });
        } catch (error) {
            console.error("Failed to mark incomplete bundle as complete:", error);
            toast({
                variant: "destructive",
                title: "Action Failed",
                description: "Could not update the user's state on the server.",
            });
        } finally {
            setIsMarkingIncomplete(false);
            setUserToMark("");
            setTalukaToMark("");
        }
    };

  const bundleCounterRows = locations.flatMap(location => {
      const locationTalukas = talukas.find(t => t.locationSlug === location.slug)?.talukas || [];
      return locationTalukas.map(taluka => {
          const counter = bundleCounters[location.slug]?.[taluka];
          const nextNew = counter?.nextBundle || 1;
          const gaps = counter?.gaps?.sort((a,b) => a - b) || [];
          const nextToAssign = gaps.length > 0 ? gaps[0] : nextNew;
          return {
              location: location.name,
              taluka,
              nextToAssign,
              nextNew,
              gaps: gaps.join(', ') || 'None'
          };
      });
  });

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader className="flex flex-row items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
            <Database className="h-6 w-6 text-primary" />
          </div>
          <div>
            <CardTitle>Locations</CardTitle>
            <CardDescription>
              Manage and upload Excel data for each location.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {locations.map((location) => (
              <Card key={location.slug}>
                <CardContent className="flex items-center justify-between p-6">
                  <h3 className="text-lg font-semibold">{location.name}</h3>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/data-management/${location.slug}`}>
                      Manage Data
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
            <div className="flex flex-row items-start gap-4">
                 <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    <Search className="h-6 w-6 text-primary" />
                </div>
                <div>
                    <CardTitle>Search Record</CardTitle>
                    <CardDescription>
                    Search for a record by its ID from the second column.
                    </CardDescription>
                </div>
            </div>
            <div className="flex gap-2">
                <Button variant="outline">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Sync Data to Device
                </Button>
                <Button variant="outline">
                    <DatabaseZap className="mr-2 h-4 w-4" />
                    Sync Changes to Server
                </Button>
            </div>
        </CardHeader>
        <CardContent>
          <form className="flex items-center gap-4">
            <Input
              type="search"
              placeholder="Enter Record ID"
              className="flex-1"
            />
            <Button type="submit">
              <Search className="mr-2 h-4 w-4" />
              Search
            </Button>
          </form>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <TrendingUp className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle>Bundle Counters Status</CardTitle>
              <CardDescription>
                Live status of the bundle assignment system for each Taluka.
              </CardDescription>
            </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Location</TableHead>
                <TableHead>Taluka</TableHead>
                <TableHead className="text-right font-bold text-primary">Next Bundle to Assign</TableHead>
                <TableHead className="text-right">Next New Bundle #</TableHead>
                <TableHead>Available Gaps (Recycled)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bundleCounterRows.length > 0 ? (
                bundleCounterRows.map((row) => (
                  <TableRow key={`${row.location}-${row.taluka}`}>
                    <TableCell>{row.location}</TableCell>
                    <TableCell className="font-medium">{row.taluka}</TableCell>
                    <TableCell className="text-right font-bold text-lg text-primary">{row.nextToAssign}</TableCell>
                    <TableCell className="text-right">{row.nextNew}</TableCell>
                    <TableCell>{row.gaps}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-24">
                    <Loader2 className="inline-block mr-2 h-4 w-4 animate-spin" />
                    Loading counter data...
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <Download className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle>Download Updated Records</CardTitle>
              <CardDescription>
                Download an Excel file of all processed records for a location.
              </CardDescription>
            </div>
        </CardHeader>
        <CardContent>
            <div className="flex items-center gap-4">
                 <Select name="location" required onValueChange={setDownloadLocation}>
                    <SelectTrigger id="location">
                      <SelectValue placeholder="Select a location" />
                    </SelectTrigger>
                    <SelectContent>
                      {locations.map((location) => (
                        <SelectItem key={location.slug} value={location.slug}>
                          {location.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                <Button onClick={handleDownload} disabled={isDownloading || !downloadLocation}>
                    {isDownloading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Downloading...
                      </>
                    ) : (
                      <>
                        <Download className="mr-2 h-4 w-4" />
                        Download
                      </>
                    )}
                </Button>
            </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
            <CardTitle>Mark Incomplete Bundle as Complete</CardTitle>
            <CardDescription>
                Manually complete a user's current bundle for a specific Taluka, allowing them to assign a new one. This does not delete any processed data.
            </CardDescription>
        </CardHeader>
        <CardContent>
            <div className="grid items-end gap-4 md:grid-cols-4">
                <div className="grid w-full gap-1.5">
                    <Label htmlFor="user-mark">User</Label>
                    <Select name="user-mark" required onValueChange={setUserToMark} value={userToMark}>
                        <SelectTrigger id="user-mark">
                          <SelectValue placeholder="Select a user" />
                        </SelectTrigger>
                        <SelectContent>
                           {allUsers.length > 0 ? allUsers.map(user => (
                            <SelectItem key={user.id} value={user.id}>{user.name} ({user.username})</SelectItem>
                          )) : (
                            <SelectItem value="no-users" disabled>No users found</SelectItem>
                          )}
                        </SelectContent>
                    </Select>
                </div>
                <div className="grid w-full gap-1.5">
                    <Label htmlFor="taluka-mark">Taluka with Active Bundle</Label>
                    <Select name="taluka-mark" required onValueChange={setTalukaToMark} value={talukaToMark} disabled={!userToMark}>
                        <SelectTrigger id="taluka-mark">
                          <SelectValue placeholder={!userToMark ? "Select user first" : "Select Taluka"} />
                        </SelectTrigger>
                        <SelectContent>
                           {activeBundlesForUser.length > 0 ? activeBundlesForUser.map(bundle => (
                            <SelectItem key={bundle.taluka} value={bundle.taluka}>{bundle.taluka}</SelectItem>
                          )) : (
                            <SelectItem value="no-talukas" disabled>
                                 {!userToMark ? "Select a user first" : "No active bundles"}
                            </SelectItem>
                          )}
                        </SelectContent>
                    </Select>
                </div>
                 <div className="grid w-full gap-1.5">
                    <Label htmlFor="bundle-display">Active Bundle</Label>
                    <Input 
                        id="bundle-display" 
                        type="text" 
                        value={bundleNoToDisplay}
                        disabled
                        readOnly
                    />
                </div>
                 <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="secondary" disabled={!userToMark || !talukaToMark || isMarkingIncomplete}>
                            {isMarkingIncomplete ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PackageCheck className="mr-2 h-4 w-4" />}
                            {isMarkingIncomplete ? "Completing..." : "Mark as Complete"}
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Confirm Completion</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will mark the active bundle <span className="font-bold">#{bundleNoToDisplay}</span> for user <span className="font-bold">{allUsers.find(u => u.id === userToMark)?.name}</span> as complete, allowing them to assign a new one. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleMarkIncompleteAsComplete}>Confirm</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
            <CardTitle>Force Complete a Bundle</CardTitle>
            <CardDescription>
                Manually mark any bundle as complete. This is useful for closing old or stuck bundles.
            </CardDescription>
        </CardHeader>
        <CardContent>
             <div className="grid items-end gap-4 md:grid-cols-5">
                <div className="grid w-full gap-1.5">
                    <Label htmlFor="user-complete">User</Label>
                    <Select name="user-complete" required onValueChange={setUserToComplete} value={userToComplete}>
                        <SelectTrigger id="user-complete">
                          <SelectValue placeholder="Select a user" />
                        </SelectTrigger>
                        <SelectContent>
                           {allUsers.length > 0 ? allUsers.map(user => (
                            <SelectItem key={user.id} value={user.id}>{user.name} ({user.username})</SelectItem>
                          )) : (
                            <SelectItem value="no-users" disabled>No users found</SelectItem>
                          )}
                        </SelectContent>
                    </Select>
                </div>
                <div className="grid w-full gap-1.5">
                    <Label htmlFor="taluka-complete">Taluka</Label>
                    <Select name="taluka-complete" required onValueChange={setTalukaToComplete} value={talukaToComplete} disabled={!userToComplete}>
                        <SelectTrigger id="taluka-complete">
                          <SelectValue placeholder={!userToComplete ? "Select user first" : "Select Taluka"} />
                        </SelectTrigger>
                        <SelectContent>
                           {availableCompleteTalukas.length > 0 ? availableCompleteTalukas.map(taluka => (
                            <SelectItem key={taluka} value={taluka}>{taluka}</SelectItem>
                          )) : (
                            <SelectItem value="no-talukas" disabled>
                                 {!userToComplete ? "Select a user first" : "No talukas for user"}
                            </SelectItem>
                          )}
                        </SelectContent>
                    </Select>
                </div>
                 <div className="grid w-full gap-1.5">
                    <Label htmlFor="bundle-complete">Bundle Number</Label>
                    <Input 
                        id="bundle-complete" 
                        type="number" 
                        placeholder="e.g. 5"
                        value={bundleNoToComplete}
                        onChange={(e) => setBundleNoToComplete(e.target.value)}
                        disabled={!talukaToComplete}
                    />
                </div>
                 <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="secondary" className="col-span-full md:col-span-2" disabled={!userToComplete || !talukaToComplete || !bundleNoToComplete || isMarkingComplete}>
                            {isMarkingComplete ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                            {isMarkingComplete ? "Completing..." : "Force Complete Bundle"}
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Confirm Force Complete</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently mark bundle <span className="font-bold">#{bundleNoToComplete}</span> in Taluka <span className="font-bold">{talukaToComplete}</span> as complete. This cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleMarkAsComplete}>Confirm</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </CardContent>
      </Card>

       <Card>
        <CardHeader>
            <CardTitle>Manual Bundle Assignment</CardTitle>
            <CardDescription>
                Manually assign or re-assign a specific bundle number to a user. This will override their current active bundle for the selected Taluka.
            </CardDescription>
        </CardHeader>
        <CardContent>
             <div className="grid items-end gap-4 md:grid-cols-4">
                <div className="grid w-full gap-1.5">
                    <Label htmlFor="user-reassign">User</Label>
                    <Select name="user-reassign" required onValueChange={setUserToReassign} value={userToReassign}>
                        <SelectTrigger id="user-reassign">
                          <SelectValue placeholder="Select a user" />
                        </SelectTrigger>
                        <SelectContent>
                           {allUsers.length > 0 ? allUsers.map(user => (
                            <SelectItem key={user.id} value={user.id}>{user.name} ({user.username})</SelectItem>
                          )) : (
                            <SelectItem value="no-users" disabled>No users found</SelectItem>
                          )}
                        </SelectContent>
                    </Select>
                </div>
                <div className="grid w-full gap-1.5">
                    <Label htmlFor="taluka-reassign">Taluka</Label>
                    <Select name="taluka-reassign" required onValueChange={setTalukaToReassign} value={talukaToReassign} disabled={!userToReassign}>
                        <SelectTrigger id="taluka-reassign">
                          <SelectValue placeholder={!userToReassign ? "Select user first" : "Select a Taluka"} />
                        </SelectTrigger>
                        <SelectContent>
                           {availableReassignTalukas.length > 0 ? availableReassignTalukas.map(taluka => (
                            <SelectItem key={taluka} value={taluka}>{taluka}</SelectItem>
                          )) : (
                            <SelectItem value="no-talukas" disabled>
                                {!userToReassign ? "Select a user first" : "No Talukas found"}
                            </SelectItem>
                          )}
                        </SelectContent>
                    </Select>
                </div>
                <div className="grid w-full gap-1.5">
                    <Label htmlFor="bundle-reassign">Bundle Number</Label>
                    <Input id="bundle-reassign" type="number" placeholder="e.g., 7" value={bundleToReassign} onChange={e => setBundleToReassign(e.target.value)} disabled={!talukaToReassign} />
                </div>
                 <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="secondary" disabled={!userToReassign || !talukaToReassign || !bundleToReassign || isReassigning}>
                            {isReassigning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BookUser className="mr-2 h-4 w-4" />}
                            {isReassigning ? "Assigning..." : "Assign Bundle"}
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Confirm Manual Assignment</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will force-assign bundle <span className="font-bold">#{bundleToReassign}</span> for Taluka <span className="font-bold">{talukaToReassign}</span> to user <span className="font-bold">{allUsers.find(u => u.id === userToReassign)?.name}</span>.
                          Their current progress on any active bundle for this Taluka will be overridden. Are you sure?
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleManualReassign}>Confirm Assignment</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
            <CardTitle>Reset User Progress</CardTitle>
            <CardDescription>
                Clear all processed data and reset bundle progress for a specific user and Taluka. This action is irreversible.
            </CardDescription>
        </CardHeader>
        <CardContent>
             <div className="grid items-end gap-4 md:grid-cols-3">
                <div className="grid w-full gap-1.5">
                    <Label htmlFor="user-reset">User</Label>
                    <Select name="user-reset" required onValueChange={setUserToReset} value={userToReset}>
                        <SelectTrigger id="user-reset">
                          <SelectValue placeholder="Select a user to reset" />
                        </SelectTrigger>
                        <SelectContent>
                          {allUsers.length > 0 ? allUsers.map(user => (
                            <SelectItem key={user.id} value={user.id}>{user.name} ({user.username})</SelectItem>
                          )) : (
                            <SelectItem value="no-users" disabled>No users found</SelectItem>
                          )}
                        </SelectContent>
                    </Select>
                </div>
                 <div className="grid w-full gap-1.5">
                    <Label htmlFor="taluka-reset">Taluka to Reset</Label>
                    <Select name="taluka-reset" required onValueChange={setTalukaToReset} value={talukaToReset} disabled={!userToReset}>
                        <SelectTrigger id="taluka-reset">
                          <SelectValue placeholder={!userToReset ? "Select a user first" : "Select a Taluka"} />
                        </SelectTrigger>
                        <SelectContent>
                           {availableResetTalukas.length > 0 ? availableResetTalukas.map(taluka => (
                            <SelectItem key={taluka} value={taluka}>{taluka}</SelectItem>
                          )) : (
                            <SelectItem value="no-talukas" disabled>
                                {!userToReset ? "Select a user first" : "No Talukas for this user's location"}
                            </SelectItem>
                          )}
                        </SelectContent>
                    </Select>
                </div>
                 <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" disabled={!userToReset || !talukaToReset || isResetting}>
                          {isResetting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                          {isResetting ? "Resetting..." : "Reset Progress"}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete all processed records and reset the bundle progress for{" "}
                          <span className="font-bold">{allUsers.find(u => u.id === userToReset)?.name}</span> in Taluka <span className="font-bold">{talukaToReset}</span>. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleResetUserProgress}>Confirm Reset</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-destructive/10">
            <DatabaseZap className="h-6 w-6 text-destructive" />
          </div>
          <div>
            <CardTitle>System Danger Zone</CardTitle>
            <CardDescription>
              Permanently reset system-wide data. Use with extreme caution.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Extreme Danger Zone!</AlertTitle>
            <AlertDescription>
              These actions are irreversible and will affect the entire system.
            </AlertDescription>
          </Alert>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={isResettingAllData}>
                      {isResettingAllData ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                      {isResettingAllData ? "Resetting..." : "Reset All Processed Data"}
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action will permanently delete ALL processed records from the server for ALL users. This cannot be undone. Enter the master password to confirm.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="space-y-2">
                    <Label htmlFor="reset-all-data-pass">Master Password</Label>
                    <Input id="reset-all-data-pass" type="password" value={dangerZonePassword} onChange={e => setDangerZonePassword(e.target.value)} />
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setDangerZonePassword("")}>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleResetAllProcessedData} disabled={!dangerZonePassword || isResettingAllData}>Confirm Reset</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={isResettingAllCounters}>
                      {isResettingAllCounters ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <DatabaseZap className="mr-2 h-4 w-4" />}
                      {isResettingAllCounters ? "Resetting..." : "Reset All ID Counters & Bundles"}
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will reset ALL bundle counters and user states on the server. Users will lose their current bundle assignments and will need to re-assign new ones. This cannot be undone. Enter the master password to confirm.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                   <div className="space-y-2">
                    <Label htmlFor="reset-counters-pass">Master Password</Label>
                    <Input id="reset-counters-pass" type="password" value={dangerZonePassword} onChange={e => setDangerZonePassword(e.target.value)} />
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setDangerZonePassword("")}>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleResetAllIdCounters} disabled={!dangerZonePassword || isResettingAllCounters}>Confirm Reset</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

    