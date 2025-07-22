
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { RefreshCw, DatabaseZap, Search, Save, AlertTriangle, Trash2, PackageCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { db as firebaseDB } from "@/lib/firebase";
import { ref, get, set, runTransaction } from "firebase/database";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, Loader2 } from "lucide-react";
import { db as dexieDB, type FileContent } from "@/lib/db";
import { cn } from "@/lib/utils";

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


const getLocationCode = (locationSlug: string) => {
    if (locationSlug === 'chhatrapati-sambhajinagar') return 'CS';
    if (locationSlug === 'ahilyanagar') return 'AH';
    return 'XX';
}

const getTalukaCode = (talukaName: string) => {
    switch(talukaName.toLowerCase()) {
        case "paithan": return "PA";
        case "phulambri": return "PH";
        case "kannad": return "KN";
        case "soegaon": return "SO";
        case "sillod": return "SI";
        case "chhatrapati sambhajinagar": return "CS";
        default: return talukaName.substring(0, 2).toUpperCase();
    }
}

const formatDate = (dateValue: any): string => {
    if (!dateValue) return '';

    // Handle Excel serial date number
    if (typeof dateValue === 'number' && dateValue > 0) {
        // Excel's epoch starts on 1899-12-30 (for compatibility with Lotus 1-2-3).
        // JavaScript's epoch is 1970-01-01.
        // The difference is 25569 days. Also, Excel incorrectly treats 1900 as a leap year.
        const date = new Date(Date.UTC(1899, 11, 30 + dateValue));
        if (!isNaN(date.getTime())) {
            const day = String(date.getUTCDate()).padStart(2, '0');
            const month = String(date.getUTCMonth() + 1).padStart(2, '0');
            const year = date.getUTCFullYear();
            return `${day}${month}${year}`;
        }
    }
    
    // Handle date strings
    if (typeof dateValue === 'string') {
        // Attempt to parse various date formats that might come from strings
        const date = new Date(dateValue);
         if (!isNaN(date.getTime())) {
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            return `${day}${month}${year}`;
        }
    }

    // Fallback for unexpected formats
    return String(dateValue);
};

export default function UserDataManagementPage() {
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [searchId, setSearchId] = useState("");
  const [searchResult, setSearchResult] = useState<FileContent | null>(null);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [isSyncSuccessPopupOpen, setIsSyncSuccessPopupOpen] = useState(false);
  const [uniqueId, setUniqueId] = useState<string | null>(null);
  const [isSyncingIn, setIsSyncingIn] = useState(false);
  const [isSyncingOut, setIsSyncingOut] = useState(false);
  const [syncInProgress, setSyncInProgress] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [password, setPassword] = useState("");
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [isDeleteAllSyncAlertOpen, setIsDeleteAllSyncAlertOpen] = useState(false);
  const [isBundleCompleteAlertOpen, setIsBundleCompleteAlertOpen] = useState(false);
  const [completedBundleInfo, setCompletedBundleInfo] = useState({ taluka: "", bundleNo: 0 });

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem("loggedInUser");
      if (storedUser) {
        const user = JSON.parse(storedUser);
        if (user.role === "user") {
          setCurrentUser(user);
        }
      }
    } catch (e) {
      console.error("Failed to get user from local storage", e);
    }
  }, []);

  const handleSyncIn = async () => {
    if (!currentUser || !currentUser.location || !currentUser.excelFile) {
        toast({ variant: "destructive", title: "Sync Failed", description: "Could not identify the current user or their assigned file." });
        return;
    }
    
    setIsSyncingIn(true);
    setSyncInProgress(0);
    toast({ title: "Syncing Data...", description: "Fetching assigned Excel data from the server." });

    const locationFilesRef = ref(firebaseDB, `files/${currentUser.location}`);
    
    try {
        const snapshot = await get(locationFilesRef);
        if (snapshot.exists()) {
            const allFiles = snapshot.val();
            let foundFileId: string | null = null;
            let foundFile: any = null;
            
            for (const fileId in allFiles) {
                if (allFiles[fileId].name === currentUser.excelFile) {
                    foundFileId = fileId;
                    foundFile = allFiles[fileId];
                    break;
                }
            }

            if (foundFile && foundFile.content && Array.isArray(foundFile.content) && foundFile.content.length > 0 && foundFileId) {
                const data = foundFile.content;
                const totalRecords = data.length;
                
                const headers = Object.keys(data[0]);
                const recordIdKey = headers.find(h => h.trim() === "Search from");
                
                if (!recordIdKey) {
                    toast({ variant: "destructive", title: "Data Invalid", description: "The Excel file must have a column named 'Search from'." });
                    setIsSyncingIn(false);
                    return;
                }
                
                // Fetch all existing record IDs for the current file to avoid duplicates
                const existingRecordIds = new Set(
                    (await dexieDB.fileContents.where('fileId').equals(foundFileId).toArray())
                    .map(rec => rec.recordId)
                );

                const recordsToAdd: FileContent[] = [];
                for(const record of data) {
                  const recordIdValue = record[recordIdKey];
                  if (recordIdValue !== null && recordIdValue !== undefined) {
                      const recordIdStr = String(recordIdValue).trim();
                      // Only add if it doesn't already exist in the local DB
                      if (!existingRecordIds.has(recordIdStr)) {
                         recordsToAdd.push({
                            fileId: foundFileId,
                            fileName: foundFile.name, // Store filename
                            recordId: recordIdStr,
                            content: record,
                            status: 'pending',
                        });
                      }
                  }
                }
                
                if (recordsToAdd.length > 0) {
                    const batchSize = 100;
                    for (let i = 0; i < recordsToAdd.length; i += batchSize) {
                      const batch = recordsToAdd.slice(i, i + batchSize);
                      await dexieDB.fileContents.bulkAdd(batch);
                      
                      const currentProgress = Math.min(
                        ((i + batchSize) / recordsToAdd.length) * 100,
                        100
                      );
                      setSyncInProgress(currentProgress);
                      await new Promise(resolve => setTimeout(resolve, 0));
                    }
                }

                const finalCount = await dexieDB.fileContents.where('fileId').equals(foundFileId).count();
                localStorage.setItem(`syncedCount_${currentUser.id}`, finalCount.toString());
                localStorage.setItem(`syncedFileId_${currentUser.id}`, foundFileId);
                
                setIsSyncSuccessPopupOpen(true);

            } else {
                 toast({ variant: "destructive", title: "Data Not Found", description: "Your assigned file content is missing or empty. Please ask an admin to re-upload." });
            }
        } else {
            toast({ variant: "destructive", title: "File Not Found", description: "Your assigned Excel file was not found in this location." });
        }
    } catch (error) {
        console.error("Data sync error:", error);
        toast({ variant: "destructive", title: "Sync Error", description: "Could not sync data to the device. Check console for details." });
    } finally {
        setIsSyncingIn(false);
    }
  };

  const handleSyncOut = async () => {
    if (!currentUser) {
        toast({ variant: "destructive", title: "Sync Failed", description: "Current user not found." });
        return;
    }
    
    setIsSyncingOut(true);
    setSyncInProgress(0);
    toast({ title: "Syncing Out...", description: "Sending processed data to the server." });

    try {
        const recordsToSync = await dexieDB.fileContents.where('status').equals('processed').toArray();
        if (recordsToSync.length === 0) {
            toast({ title: "Nothing to Sync", description: "All processed records have already been synced." });
            setIsSyncingOut(false);
            return;
        }

        const totalToSync = recordsToSync.length;
        let syncedCount = 0;

        for (const record of recordsToSync) {
            // Re-fetch active bundles inside the loop in case they change
            const activeBundles: ActiveBundles = JSON.parse(localStorage.getItem(`activeBundles_${currentUser.id}`) || '{}');

            if (!record.uniqueId || !record.content || !record.id) continue;
            
            const headers = Object.keys(record.content);
            const talukaKey = headers.find(h => h.trim().toLowerCase() === 'taluka');
            
            if (!talukaKey || !record.content[talukaKey]) {
                console.warn("Skipping record due to missing Taluka:", record);
                continue;
            };

            const talukaName = String(record.content[talukaKey]).trim();
            const bundleInfo = activeBundles[talukaName];

            if (!bundleInfo) {
                console.warn(`Skipping record due to missing bundle info for Taluka: ${talukaName}`, record);
                continue;
            }

            const recordWithMeta = {
                ...record.content,
                uniqueId: record.uniqueId,
                processedBy: record.processedBy,
                processedAt: record.processedAt,
                bundleNo: bundleInfo.bundleNo,
                sourceFile: record.fileName || 'Unknown',
            };
            
            const recordPath = `processedRecords/${currentUser.location}/${talukaName}/bundle-${bundleInfo.bundleNo}/${record.uniqueId}`;
            const dbRecordRef = ref(firebaseDB, recordPath);
            
            await set(dbRecordRef, recordWithMeta);
            
            // Update local Dexie record status to 'synced'
            await dexieDB.fileContents.update(record.id, { status: 'synced' });
            
            syncedCount++;
            setSyncInProgress((syncedCount / totalToSync) * 100);
            await new Promise(resolve => setTimeout(resolve, 0)); // Yield to the event loop
        }
        
        toast({ title: "Sync Complete", description: `Successfully synced ${syncedCount} records to the server.` });

    } catch (error) {
        console.error("Sync out error:", error);
        toast({ variant: "destructive", title: "Sync Out Error", description: "An error occurred while sending data to the server." });
    } finally {
        setIsSyncingOut(false);
    }
  };


  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !searchId) return;

    const trimmedSearchId = searchId.trim();

    try {
        const syncedFileId = localStorage.getItem(`syncedFileId_${currentUser.id}`);
        if (!syncedFileId) {
            toast({
                variant: "destructive",
                title: "Search Failed",
                description: "Please sync data to your device first.",
            });
            return;
        }

        const foundRecord = await dexieDB.fileContents
            .where('recordId').equals(trimmedSearchId)
            .and(item => item.fileId === syncedFileId)
            .first();

        if (foundRecord) {
             if (foundRecord.status !== 'pending') {
                toast({
                    variant: "destructive",
                    title: "Already Processed",
                    description: "This record has already been processed and cannot be viewed again."
                });
                return;
            }
            
            setSearchResult(foundRecord);
            setUniqueId(null);
            setIsPopupOpen(true);
        } else {
            toast({
                variant: "destructive",
                title: "Not Found",
                description: `No record found with ID: ${trimmedSearchId}`,
            });
            setSearchResult(null);
        }
    } catch (error) {
        console.error("Search error:", error);
        toast({
            variant: "destructive",
            title: "Search Failed",
            description: "An error occurred while searching the local database.",
        });
    }
};

  const handleGenerateId = async () => {
    if (!currentUser || !searchResult) return;

    const storedActiveBundles = localStorage.getItem(`activeBundles_${currentUser.id}`);
    const activeBundles: ActiveBundles = storedActiveBundles ? JSON.parse(storedActiveBundles) : {};
    
    const headers = Object.keys(searchResult.content);
    const talukaKey = headers.find(h => h.trim().toLowerCase() === 'taluka');
    
    if (!talukaKey || !searchResult.content[talukaKey]) {
         toast({ variant: "destructive", title: "Error", description: "Taluka not found in the record." });
         return;
    }

    const talukaName = String(searchResult.content[talukaKey]).trim();
    const activeBundle = activeBundles[talukaName];

    if (!activeBundle) {
        toast({ variant: "destructive", title: "Error", description: `No active bundle found for ${talukaName}. Please assign one from the dashboard.` });
        return;
    }

    if (activeBundle.count >= 250) {
        toast({ variant: "destructive", title: "Bundle Complete", description: "You have processed 250 records for this Taluka. Please assign a new bundle from the dashboard." });
        return;
    }

    const locationCode = getLocationCode(currentUser.location);
    const talukaCode = getTalukaCode(activeBundle.taluka);
    const sequentialNumber = (activeBundle.bundleNo - 1) * 250 + activeBundle.count;
    const newId = `${locationCode}${talukaCode}${sequentialNumber}`;
    
    setUniqueId(newId);
    
    toast({
        title: "ID Generated",
        description: `Unique ID ${newId} is ready.`,
    });
  };

  const saveRecordData = async () => {
    if (!currentUser || !searchResult || !uniqueId) return false;

    const storedActiveBundles = localStorage.getItem(`activeBundles_${currentUser.id}`);
    const activeBundles: ActiveBundles = storedActiveBundles ? JSON.parse(storedActiveBundles) : {};

    try {
        if (!searchResult.id) return false;
        
        const headers = Object.keys(searchResult.content);
        const talukaKey = headers.find(h => h.trim().toLowerCase() === 'taluka');
        
        if (!talukaKey || !searchResult.content[talukaKey]) {
             toast({ variant: "destructive", title: "Save Error", description: "Taluka not found in the record." });
             return false;
        }

        const talukaName = String(searchResult.content[talukaKey]).trim();
        const activeBundle = activeBundles[talukaName];

        if (!activeBundle) {
            toast({ variant: "destructive", title: "Save Error", description: `No active bundle found for ${talukaName}.` });
            return false;
        }
        
        // --- ATOMIC UPDATE LOGIC ---
        const newCount = activeBundle.count + 1;
        const updatedBundle = { ...activeBundle, count: newCount };
        const updatedBundles = { ...activeBundles, [talukaName]: updatedBundle };
        
        // Update local storage first for immediate UI consistency
        localStorage.setItem(`activeBundles_${currentUser.id}`, JSON.stringify(updatedBundles));
        
        // Update Firebase in the background (don't wait for it)
        set(ref(firebaseDB, `userStates/${currentUser.id}/activeBundles`), updatedBundles);
        
        await dexieDB.fileContents.update(searchResult.id, {
            status: 'processed',
            uniqueId: uniqueId,
            processedBy: currentUser.id,
            processedAt: new Date().toISOString(),
            fileName: searchResult.fileName, // Ensure filename is preserved
        });

        // Check if bundle is now complete
        if (newCount === 250) {
            setCompletedBundleInfo({ taluka: talukaName, bundleNo: activeBundle.bundleNo });
            setIsBundleCompleteAlertOpen(true);
        }

        return true; // Indicate success

    } catch(e) {
        console.error("Error saving record data:", e);
        toast({ variant: "destructive", title: "Save Failed", description: "An error occurred while saving the record data." });
        return false; // Indicate failure
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    if(uniqueId){
      const dataSaved = await saveRecordData();
      if (dataSaved) {
        toast({
          title: "Saved Successfully",
          description: `Record with ID ${uniqueId} has been saved.`,
        });
        setTimeout(() => {
          setIsPopupOpen(false);
          setUniqueId(null);
          setSearchResult(null);
          setSearchId("");
        }, 1000);
      }
    } else {
        toast({
            variant: "destructive",
            title: "ID Not Generated",
            description: "Please generate a unique ID before saving.",
        });
    }
    setIsSaving(false);
  };
  
  const handleDeleteUpdatedData = async () => {
    if (password !== "masterpass") {
        toast({ variant: "destructive", title: "Incorrect Password", description: "The password you entered is incorrect." });
        return;
    }

    if (!currentUser) {
        toast({ variant: "destructive", title: "Action Failed", description: "Could not identify current user." });
        return;
    }

    try {
        const updatedCount = await dexieDB.fileContents.where('status').notEqual('pending').count();
        if (updatedCount === 0) {
            toast({ title: "No Data", description: "There are no updated records to clear." });
        } else {
            await dexieDB.fileContents.where('status').notEqual('pending').modify({ status: 'pending', uniqueId: undefined, processedAt: undefined, processedBy: undefined });
            
            // Also reset bundle counts
            const storedActiveBundles = localStorage.getItem(`activeBundles_${currentUser.id}`);
            const activeBundles: ActiveBundles = storedActiveBundles ? JSON.parse(storedActiveBundles) : {};
            Object.keys(activeBundles).forEach(taluka => {
                activeBundles[taluka].count = 0;
            });
            localStorage.setItem(`activeBundles_${currentUser.id}`, JSON.stringify(activeBundles));
            
            // Sync reset bundles to firebase
            const userStateRef = ref(firebaseDB, `userStates/${currentUser.id}/activeBundles`);
            await set(userStateRef, activeBundles);

            localStorage.removeItem(`processedIds_${currentUser.id}`);
            localStorage.removeItem(`syncedOutIds_${currentUser.id}`);

            toast({ title: "Success", description: `Successfully cleared the 'processed' status of ${updatedCount} records on this device.` });
        }
    } catch (e) {
        console.error("Failed to delete updated records", e);
        toast({ variant: "destructive", title: "Deletion Failed", description: "An error occurred while clearing records." });
    } finally {
        setIsDeleteAlertOpen(false);
        setPassword("");
    }
  };

  const handleDeleteAllSyncedData = async () => {
    if (password !== "masterpass") {
        toast({ variant: "destructive", title: "Incorrect Password", description: "The password you entered is incorrect." });
        return;
    }

    if (!currentUser) {
        toast({ variant: "destructive", title: "Action Failed", description: "Could not identify current user." });
        return;
    }

    try {
        await dexieDB.fileContents.clear();
        localStorage.removeItem(`activeBundles_${currentUser.id}`);
        localStorage.removeItem(`syncedCount_${currentUser.id}`);
        localStorage.removeItem(`syncedFileId_${currentUser.id}`);
        localStorage.removeItem(`processedIds_${currentUser.id}`);
        localStorage.removeItem(`syncedOutIds_${currentUser.id}`);

        // Also clear from firebase
        const userStateRef = ref(firebaseDB, `userStates/${currentUser.id}`);
        await set(userStateRef, null);
        
        toast({ title: "Success", description: `All synced data and bundle progress has been deleted from this device. Please sync again to get new data.` });

    } catch (e) {
        console.error("Failed to delete all synced data", e);
        toast({ variant: "destructive", title: "Deletion Failed", description: "An error occurred while deleting all synced data." });
    } finally {
        setIsDeleteAllSyncAlertOpen(false);
        setPassword("");
    }
  };

  const pdfRequiredKey = searchResult?.content ? Object.keys(searchResult.content).find(k => k.trim().toLowerCase() === 'pdf required') : undefined;
  const isPdfRequired = pdfRequiredKey && String(searchResult?.content[pdfRequiredKey]).trim().toLowerCase() === 'yes';
  

  const isSyncing = isSyncingIn || isSyncingOut;

  return (
    <>
      <div className="space-y-8">
        <Card>
          <CardHeader>
            <div className="flex w-full flex-col gap-4">
              <div className="flex w-full items-start justify-between">
                <div>
                  <CardTitle>Search Record</CardTitle>
                  <CardDescription>
                    Search for a record by its ID from the 'Search from' column.
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleSyncIn}
                    className="bg-accent text-accent-foreground hover:bg-accent/90"
                    disabled={isSyncing}
                  >
                    {isSyncingIn ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Syncing In...
                        </>
                    ) : (
                        <>
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Sync Data to Device
                        </>
                    )}
                  </Button>
                  <Button variant="outline" onClick={handleSyncOut} disabled={isSyncing}>
                    {isSyncingOut ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Syncing Out...
                        </>
                    ) : (
                        <>
                            <DatabaseZap className="mr-2 h-4 w-4" />
                            Sync Changes to Server
                        </>
                    )}
                  </Button>
                </div>
              </div>
               {isSyncing && (
                <div className="space-y-2 pt-2">
                    <p className="text-sm text-muted-foreground">Sync in progress, please wait...</p>
                    <Progress value={syncInProgress} className="h-2 w-full" />
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearch} className="flex items-center gap-4">
              <Input
                type="search"
                placeholder="Enter Record ID from 'Search from' column"
                className="flex-1"
                value={searchId}
                onChange={(e) => setSearchId(e.target.value)}
                disabled={isSyncing}
              />
              <Button type="submit" className="bg-primary" disabled={isSyncing}>
                <Search className="mr-2 h-4 w-4" />
                Search
              </Button>
            </form>
          </CardContent>
        </Card>
        
        <Card className="border-destructive">
           <CardHeader>
            <div className="flex flex-row items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-destructive/10">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <CardTitle>System Danger Zone</CardTitle>
                <CardDescription>
                  These actions are permanent and can result in data loss.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4">
            <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
                <AlertDialogTrigger asChild>
                    <Button variant="destructive">
                      <DatabaseZap className="mr-2 h-4 w-4" />
                      Delete Offline Updated Records
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will reset the 'processed' status of all local records, making them available for processing again. Bundle counts and sync history will also be reset. This action cannot be undone. Please enter the master password to confirm.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="space-y-2">
                        <Label htmlFor="password">Master Password</Label>
                        <Input 
                            id="password" 
                            type="password" 
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter master password"
                        />
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setPassword("")}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteUpdatedData} disabled={!password}>Confirm Reset</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <AlertDialog open={isDeleteAllSyncAlertOpen} onOpenChange={setIsDeleteAllSyncAlertOpen}>
                <AlertDialogTrigger asChild>
                    <Button variant="destructive">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete All Synced Data
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete All Synced Data?</AlertDialogTitle>
                        <AlertDialogDescription>
                           This will permanently delete all synced data and bundle progress from this device. This action cannot be undone. Please enter the master password to confirm.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="space-y-2">
                        <Label htmlFor="delete-all-password">Master Password</Label>
                        <Input 
                            id="delete-all-password" 
                            type="password" 
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter master password"
                        />
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setPassword("")}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteAllSyncedData} disabled={!password}>Confirm Deletion</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>

      <Sheet open={isPopupOpen} onOpenChange={setIsPopupOpen}>
        <SheetContent className="sm:max-w-xl w-full overflow-y-auto">
            <SheetHeader>
                <SheetTitle>Record Details</SheetTitle>
                <SheetDescription>
                Information for the selected record. Generate an ID and then save.
                </SheetDescription>
            </SheetHeader>
            <div className="py-4">
            <div className="grid gap-4">
                {searchResult && Object.entries(searchResult.content).map(([key, value]) => {
                  const isPdfRow = key.trim().toLowerCase() === 'pdf required';
                  const pdfValue = String(value).trim().toLowerCase();
                  return (
                    <div 
                      className={cn("grid grid-cols-3 items-start gap-4", {
                        "bg-destructive/10 p-2 rounded-md": isPdfRow && pdfValue === 'yes',
                        "bg-green-100 dark:bg-green-900/20 p-2 rounded-md": isPdfRow && pdfValue === 'no',
                      })} 
                      key={key}
                    >
                        <Label className="text-right text-sm font-medium pt-1">
                        {key}
                        </Label>
                        <p className="col-span-2 break-words text-sm">
                            {key.toLowerCase().includes('date') ? formatDate(value) : String(value ?? '')}
                        </p>
                    </div>
                  );
                })}
                
                {uniqueId && (
                    <div className="grid grid-cols-3 items-center gap-4 pt-4 border-t mt-4">
                        <Label className="text-right font-semibold">Unique ID</Label>
                        <p className="col-span-2 font-bold text-lg text-primary">{uniqueId}</p>
                    </div>
                )}
            </div>
          </div>
          <SheetFooter className="gap-2 sm:justify-between flex-wrap sticky bottom-0 bg-background py-4">
            <Button 
                onClick={handleGenerateId} 
                disabled={!!uniqueId || isSaving}
                variant={isPdfRequired ? "destructive" : "default"}
            >
              Generate Unique ID
            </Button>
            
            <div className="flex gap-2">
                {isPdfRequired ? (
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button 
                                variant="destructive"
                                disabled={isSaving}
                            >
                                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                {isSaving ? "Saving..." : "Save Record"}
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Confirm Action</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Have you captured the photo for this record? This action cannot be undone.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleSave}>Confirm & Save</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                ) : (
                    <Button 
                        onClick={handleSave} 
                        disabled={isSaving}
                        variant="default"
                    >
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        {isSaving ? "Saving..." : "Save Record"}
                    </Button>
                )}
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>
      
      <Dialog open={isSyncSuccessPopupOpen} onOpenChange={setIsSyncSuccessPopupOpen}>
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
                <div className="flex justify-center">
                    <CheckCircle className="h-16 w-16 text-green-500" />
                </div>
                <DialogTitle className="text-center text-xl">Sync Successful!</DialogTitle>
                <DialogDescription className="text-center">
                    Data for {currentUser?.excelFile || 'your assigned file'} is now available on this device. You can start searching for records.
                </DialogDescription>
            </DialogHeader>
            <DialogFooter className="sm:justify-center">
                <Button onClick={() => setIsSyncSuccessPopupOpen(false)}>
                    OK
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isBundleCompleteAlertOpen} onOpenChange={setIsBundleCompleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex justify-center">
                <PackageCheck className="h-16 w-16 text-green-500" />
            </div>
            <AlertDialogTitle className="text-center text-2xl">Bundle Complete!</AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              Congratulations! You have successfully processed all 250 records for bundle #{completedBundleInfo.bundleNo} in {completedBundleInfo.taluka}.
              <br/><br/>
              <span className="font-semibold text-destructive">You must now sync your changes to the server before you can be assigned a new bundle for this Taluka.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-center">
            <AlertDialogAction onClick={() => setIsBundleCompleteAlertOpen(false)}>
              OK, I Will Sync
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
