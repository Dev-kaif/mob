
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  CloudDownload,
  Smartphone,
  ListTodo,
  Server,
  Loader2,
  MapPin,
  PackagePlus,
  AlertTriangle,
  FileCog,
  PackageCheck,
} from "lucide-react";
import { locations } from "@/lib/locations";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { talukas } from "@/lib/talukas";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { db as firebaseDB } from "@/lib/firebase";
import { ref, runTransaction, get, remove, set, onValue, update } from "firebase/database";
import { Input } from "@/components/ui/input";
import { db as dexieDB } from "@/lib/db";
import { useLiveQuery } from "dexie-react-hooks";


interface User {
  id: string;
  name: string;
  location: string;
}

interface ActiveBundle {
  taluka: string;
  count: number;
  bundleNo: number;
}

interface ActiveBundles {
  [taluka: string]: ActiveBundle;
}

export default function UserDashboardPage() {
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAssigning, setIsAssigning] = useState(false);
  const [selectedTaluka, setSelectedTaluka] = useState<string>("");
  const [activeBundles, setActiveBundles] = useState<ActiveBundles>({});
  const [pdfNamingStrategy, setPdfNamingStrategy] = useState("intimation");
  
  // States for PDF naming password dialog
  const [isPdfNamingDialogOpen, setIsPdfNamingDialogOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [newNamingStrategy, setNewNamingStrategy] = useState("");

  const syncedCount = useLiveQuery(() => 
      currentUser ? parseInt(localStorage.getItem(`syncedCount_${currentUser.id}`) || "0", 10) : 0,
      [currentUser]
  ) || 0;

  const locallyProcessedCount = useLiveQuery(async () => {
    if (!currentUser) return 0;
    // Count records that are processed or synced
    return await dexieDB.fileContents.where('status').anyOf('processed', 'synced').count();
  }, [currentUser]) || 0;
  
  const pendingSyncOutCount = useLiveQuery(async () => {
      if (!currentUser) return 0;
      return await dexieDB.fileContents.where('status').equals('processed').count();
  }, [currentUser]) || 0;

  const pendingSyncForSelectedTaluka = useLiveQuery(async () => {
    if (!selectedTaluka) return 0;
    
    const records = await dexieDB.fileContents
        .where('status').equals('processed')
        .toArray();

    return records.filter(rec => {
        const headers = Object.keys(rec.content);
        const talukaKey = headers.find(h => h.trim().toLowerCase() === 'taluka');
        return talukaKey && rec.content[talukaKey] === selectedTaluka;
    }).length;
  }, [selectedTaluka]);


  useEffect(() => {
    if (typeof window !== "undefined") {
      const loadInitialData = async () => {
        setIsLoading(true);
        try {
          const storedUser = localStorage.getItem("loggedInUser");
          if (storedUser) {
            const user: User = JSON.parse(storedUser);
            setCurrentUser(user);

            // Fetch current bundles from Firebase on load to stay in sync
            const userStateRef = ref(firebaseDB, `userStates/${user.id}/activeBundles`);
            let currentBundles: ActiveBundles = {};
            
            const stateListener = onValue(userStateRef, (snapshot) => {
              const bundlesFromDb = snapshot.val() || {};
              localStorage.setItem(`activeBundles_${user.id}`, JSON.stringify(bundlesFromDb));
              setActiveBundles(bundlesFromDb);
              currentBundles = bundlesFromDb; // Keep a mutable copy for other listeners
            });
            
            // Listen for server-side state resets from the admin
            const resetRef = ref(firebaseDB, `userStateResets/${user.id}`);
            const resetListener = onValue(resetRef, async (snapshot) => {
                if (snapshot.exists()) {
                    const resets = snapshot.val();
                    let bundlesChanged = false;
                    for (const talukaToReset in resets) {
                        if(resets[talukaToReset]?.type === 'manual_assign') {
                             toast({
                                title: "Admin Action",
                                description: `A new bundle for ${talukaToReset} has been assigned to you by an administrator. The page will now refresh to apply changes.`
                             });
                             // A page refresh is the safest way to ensure all state (local and remote) is consistent
                             setTimeout(() => window.location.reload(), 3000);
                        } else if (currentBundles[talukaToReset]) {
                            // Standard reset
                            delete currentBundles[talukaToReset];
                            toast({
                                title: "Admin Action",
                                description: `Your progress for ${talukaToReset} has been reset by an administrator.`
                            });
                             bundlesChanged = true;
                        }
                    }

                    if (bundlesChanged) {
                        const newBundles = { ...currentBundles };
                        localStorage.setItem(`activeBundles_${user.id}`, JSON.stringify(newBundles));
                        setActiveBundles(newBundles);
                        await set(ref(firebaseDB, `userStates/${user.id}/activeBundles`), newBundles);
                    }
                    
                    // Clear the reset signals from the server
                    await remove(resetRef);
                }
            });

            // Check for forced bundle assignment from admin
            onValue(ref(firebaseDB, `userStates/${user.id}/activeBundles`), (forceSnapshot) => {
                const bundlesFromDb = forceSnapshot.val() || {};
                 if (JSON.stringify(currentBundles) !== JSON.stringify(bundlesFromDb)) {
                    localStorage.setItem(`activeBundles_${user.id}`, JSON.stringify(bundlesFromDb));
                    setActiveBundles(bundlesFromDb);
                    currentBundles = bundlesFromDb;
                     toast({
                         title: "Admin Action",
                         description: `Your active bundles have been updated by an admin.`
                     });
                }
            });


            // Load PDF naming strategy
            const storedStrategy = localStorage.getItem(`pdfNamingStrategy_${user.id}`);
            if (storedStrategy) {
              setPdfNamingStrategy(storedStrategy);
            }
            
            // Cleanup listeners
            return () => {
              stateListener();
              resetListener();
            };
          }
        } catch (e) {
          console.error("Failed to parse data or sync with Firebase", e);
        } finally {
          setIsLoading(false);
        }
      }
      loadInitialData();
    }
  }, []);

  const handlePdfNamingChangeRequest = (value: string) => {
    setNewNamingStrategy(value);
    setIsPdfNamingDialogOpen(true);
  };
  
  const handleConfirmPdfNamingChange = () => {
    if (password !== "7532") {
        toast({ variant: "destructive", title: "Incorrect Password" });
        return;
    }
    if (!currentUser || !newNamingStrategy) return;

    setPdfNamingStrategy(newNamingStrategy);
    localStorage.setItem(`pdfNamingStrategy_${currentUser.id}`, newNamingStrategy);
    toast({
      title: "Setting Saved",
      description: `PDFs will now be named by ${newNamingStrategy === 'intimation' ? 'Intimation No.' : 'Unique ID'}.`,
    });
    
    // Reset and close dialog
    setPassword("");
    setNewNamingStrategy("");
    setIsPdfNamingDialogOpen(false);
  };


  const handleAssignBundle = async () => {
    if (!currentUser || !selectedTaluka) {
      toast({ variant: "destructive", title: "Assignment Failed", description: "Please select a Taluka first." });
      return;
    }

    const activeBundleForSelectedTaluka = activeBundles[selectedTaluka];
    
    // Perform all checks upfront
    if (activeBundleForSelectedTaluka) {
      // Check if bundle is incomplete
      if (activeBundleForSelectedTaluka.count < 250) {
        toast({
            variant: "destructive",
            title: "Bundle In Progress",
            description: `You must complete bundle #${activeBundleForSelectedTaluka.bundleNo} for ${selectedTaluka} before assigning a new one.`,
        });
        return;
      }
      // Check if bundle is complete but has pending syncs
      if (activeBundleForSelectedTaluka.count >= 250 && pendingSyncForSelectedTaluka > 0) {
          toast({
              variant: "destructive",
              title: "Sync Required",
              description: `You have ${pendingSyncForSelectedTaluka} unsynced records for your completed bundle. Please sync changes to the server before getting a new bundle.`,
          });
          return;
      }
      // This is a general catch-all just in case
      toast({
        variant: "destructive",
        title: "Bundle Already Active",
        description: `You already have an active bundle for ${selectedTaluka}. Please complete and sync it before assigning a new one.`,
      });
      return;
    }
    
    setIsAssigning(true);
    try {
        const bundleCounterRef = ref(firebaseDB, `bundleCounters/${currentUser.location}/${selectedTaluka}`);
        
        let assignedBundleNo = -1;

        const { committed, snapshot } = await runTransaction(bundleCounterRef, (currentData) => {
            if (currentData === null) {
                // First time this taluka is being assigned, start with bundle 1
                assignedBundleNo = 1;
                return { nextBundle: 2, gaps: [] };
            }

            if (currentData.gaps && Array.isArray(currentData.gaps) && currentData.gaps.length > 0) {
                 // Sort gaps numerically and take the smallest one
                currentData.gaps.sort((a: number, b: number) => a - b);
                assignedBundleNo = currentData.gaps.shift(); // Take the first (smallest) gap and remove it
            } else {
                 // Standard case: assign the next bundle number
                assignedBundleNo = currentData.nextBundle || 1;
                currentData.nextBundle = (currentData.nextBundle || 1) + 1;
            }
            
            return currentData;
        });

        if (committed && assignedBundleNo !== -1) {
             const newBundle: ActiveBundle = { 
                taluka: selectedTaluka, 
                count: 0, 
                bundleNo: assignedBundleNo
            };
            
            const updatedBundles = {
                ...activeBundles,
                [selectedTaluka]: newBundle
            };

            // This is the most critical part: update both local state and Firebase state
            localStorage.setItem(`activeBundles_${currentUser.id}`, JSON.stringify(updatedBundles));
            
            const userStateRef = ref(firebaseDB, `userStates/${currentUser.id}/activeBundles`);
            await set(userStateRef, updatedBundles);
            
            // This ensures the React component re-renders with the new bundle
            setActiveBundles(updatedBundles);

            toast({
              title: "Bundle Assigned",
              description: `You have been assigned bundle #${assignedBundleNo} for ${selectedTaluka}. You can now process up to 250 records.`,
            });
        } else {
             toast({ variant: "destructive", title: "Assignment Failed", description: "Could not get a new bundle from the server. It might be busy. Please try again." });
        }
    } catch(error) {
        console.error("Bundle assignment error:", error);
        toast({ variant: "destructive", title: "Assignment Error", description: "An error occurred while assigning the bundle. Please check your network connection." });
    } finally {
        setIsAssigning(false);
    }
  };

  const isBundleForSelectedTalukaActive = !!activeBundles[selectedTaluka];
  const canAssignNewBundle = selectedTaluka && !isBundleForSelectedTalukaActive;
  const isBundleComplete = isBundleForSelectedTalukaActive && activeBundles[selectedTaluka].count >= 250;

  const pendingToProcess = syncedCount - locallyProcessedCount;

  const statCards = [
    {
      title: "Synced to Device",
      value: syncedCount,
      icon: CloudDownload,
      color: "text-blue-500",
    },
    {
      title: "Locally Processed",
      value: locallyProcessedCount,
      icon: Smartphone,
      color: "text-green-500",
    },
    {
      title: "Pending to Process",
      value: pendingToProcess < 0 ? 0 : pendingToProcess,
      icon: ListTodo,
      color: "text-orange-500",
    },
    {
      title: "Pending Sync Out",
      value: pendingSyncOutCount,
      icon: Server,
      color: "text-red-500",
    },
  ];

  const assignedLocationName =
    locations.find((l) => l.slug === currentUser?.location)?.name ||
    currentUser?.location;

  const availableTalukas =
    talukas.find((t) => t.locationSlug === currentUser?.location)?.talukas || [];
  
  const allActiveBundles = Object.values(activeBundles);

  return (
    <>
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Offline Sync Status</CardTitle>
            <CardDescription>
              Your local device data summary. Go to{" "}
              <Link
                href="/user/data-management"
                className="text-primary underline"
              >
                Data Management
              </Link>{" "}
              to sync.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex h-24 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-4">Loading stats...</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {statCards.map((stat, index) => (
                  <Card key={index}>
                    <CardContent className="flex items-center gap-4 p-4">
                      <stat.icon className={`h-8 w-8 ${stat.color}`} />
                      <div>
                        <p className="text-2xl font-bold">{stat.value}</p>
                        <p className="text-sm text-muted-foreground">
                          {stat.title}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Assign Your Work</CardTitle>
              <CardDescription>
                Select your active Taluka. You can assign a new bundle once the current one is complete and synced.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
               <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div className="space-y-4">
                      <div className="flex items-center gap-3 rounded-lg border p-4">
                          <MapPin className="h-6 w-6 text-primary" />
                          <span className="text-lg font-semibold">
                            {assignedLocationName}
                          </span>
                      </div>
                      
                      {allActiveBundles.length > 0 ? (
                        <div className="space-y-3">
                          <h4 className="font-semibold text-muted-foreground">Active Bundle Summary</h4>
                          <div className="grid gap-2">
                            {allActiveBundles.map(bundle => (
                                <Card key={bundle.taluka} className={bundle.count >= 250 ? 'border-green-500' : ''}>
                                  <CardContent className="p-3">
                                      <div className="flex justify-between items-center">
                                          <div>
                                              <p className="font-semibold">{bundle.taluka}</p>
                                              <p className="text-sm text-muted-foreground">Bundle #{bundle.bundleNo}</p>
                                          </div>
                                          <div className="text-right">
                                              <p className={`font-bold text-lg ${bundle.count >= 250 ? 'text-green-500' : 'text-primary'}`}>{bundle.count} / 250</p>
                                              {bundle.count >= 250 && <p className="text-xs font-semibold text-green-500 flex items-center gap-1"><PackageCheck className="h-3 w-3" /> Complete</p>}
                                          </div>
                                      </div>
                                  </CardContent>
                                </Card>
                            ))}
                          </div>
                        </div>
                      ) : (
                         <div className="mt-4 space-y-2 rounded-lg border border-dashed p-4 text-center">
                            <h4 className="font-semibold text-muted-foreground">No Active Bundles</h4>
                            <p className="text-sm text-muted-foreground">Assign a new bundle to get started.</p>
                         </div>
                      )}

                  </div>
                  <div className="space-y-4">
                      <div className="space-y-2">
                        <h3 className="font-semibold">1. Select a Taluka</h3>
                        <Select
                          disabled={isLoading || availableTalukas.length === 0}
                          onValueChange={setSelectedTaluka}
                          value={selectedTaluka}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select a taluka to assign" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableTalukas.map((taluka) => (
                              <SelectItem key={taluka} value={taluka}>
                                {taluka}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <h3 className="font-semibold">2. Get New Bundle</h3>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                              <Button className="w-full" disabled={!canAssignNewBundle || isAssigning}>
                                  {isAssigning ? (
                                      <>
                                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                          Assigning...
                                      </>
                                  ) : (
                                      <>
                                          <PackagePlus className="mr-2 h-4 w-4" />
                                          Assign New Bundle
                                      </>
                                  )}
                              </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                              <AlertDialogHeader>
                                  <AlertDialogTitle>Confirm Bundle Assignment</AlertDialogTitle>
                                  <AlertDialogDescription>
                                      This will start a new bundle for {selectedTaluka}. You will be able to process 250 new records. Are you sure you want to continue?
                                  </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={handleAssignBundle} disabled={isAssigning}>Confirm</AlertDialogAction>
                              </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                         {selectedTaluka && isBundleForSelectedTalukaActive && !isBundleComplete &&(
                             <Alert>
                                <AlertTriangle className="h-4 w-4" />
                                <AlertTitle>Bundle In Progress</AlertTitle>
                                <AlertDescription>
                                  You already have an active bundle for {selectedTaluka}. Complete and sync it before assigning a new one.
                                </AlertDescription>
                            </Alert>
                        )}
                        {selectedTaluka && isBundleComplete && pendingSyncForSelectedTaluka > 0 && (
                            <Alert variant="destructive">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertTitle>Sync Required</AlertTitle>
                                <AlertDescription>
                                  You have {pendingSyncForSelectedTaluka} pending record(s) for {selectedTaluka}. Please sync changes to the server before assigning a new bundle.
                                </AlertDescription>
                            </Alert>
                        )}
                        <p className="text-xs text-muted-foreground">
                          A new bundle can only be assigned once the previous one is complete (250 IDs) and synced.
                        </p>
                      </div>
                  </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                  <FileCog className="h-6 w-6 text-primary" />
                  <CardTitle>Settings</CardTitle>
              </div>
              <CardDescription>
                Customize application settings.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="font-semibold">PDF Naming Convention</Label>
                <RadioGroup value={pdfNamingStrategy} onValueChange={handlePdfNamingChangeRequest} disabled={isLoading}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="intimation" id="r-intimation" />
                    <Label htmlFor="r-intimation">By Intimation No.</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="uniqueId" id="r-uniqueid" />
                    <Label htmlFor="r-uniqueid">By Unique ID</Label>
                  </div>
                </RadioGroup>
                <p className="text-xs text-muted-foreground">
                  Ahilyanagar location will always use Unique ID.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog open={isPdfNamingDialogOpen} onOpenChange={setIsPdfNamingDialogOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Confirm Change</AlertDialogTitle>
                <AlertDialogDescription>
                    To change the PDF naming convention, please enter the password.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-2">
                <Label htmlFor="pdf-password">Password</Label>
                <Input 
                    id="pdf-password" 
                    type="password"
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)} 
                />
            </div>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setPassword("")}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleConfirmPdfNamingChange} disabled={!password}>
                    Confirm
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

    