
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { locations } from "@/lib/locations";
import { Trash2, Edit } from "lucide-react";
import { db as firebaseDB } from "@/lib/firebase";
import { ref, onValue, set, remove } from "firebase/database";
import { Loader2 } from "lucide-react";


interface User {
  id: string;
  name: string;
  username: string;
  mobile: string;
  location: string;
  excelFile: string;
}

interface UploadedFile {
    id: string;
    name: string;
}

export default function IdCreationPage() {
  const { toast } = useToast();
  const [selectedLocation, setSelectedLocation] = useState<string>("");
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [availableExcels, setAvailableExcels] = useState<UploadedFile[]>([]);

  // State for editing a user
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editSelectedLocation, setEditSelectedLocation] = useState("");
  const [editAvailableExcels, setEditAvailableExcels] = useState<UploadedFile[]>([]);


  useEffect(() => {
    const usersRef = ref(firebaseDB, 'users');
    setIsLoading(true);
    const unsubscribe = onValue(usersRef, (snapshot) => {
        const data = snapshot.val();
        const usersList: User[] = [];
        if (data) {
            for (const id in data) {
                usersList.push({ id, ...data[id] });
            }
        }
        setUsers(usersList);
        setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const fetchExcelsForLocation = (location: string, setter: React.Dispatch<React.SetStateAction<UploadedFile[]>>) => {
      if (!location) {
        setter([]);
        return;
      }
      const filesRef = ref(firebaseDB, `files/${location}`);
      const unsubscribe = onValue(filesRef, (snapshot) => {
          const data = snapshot.val();
          const filesList: UploadedFile[] = [];
          if (data) {
              for (const id in data) {
                  filesList.push({ id, name: data[id].name });
              }
          }
          setter(filesList);
      });
      return () => unsubscribe();
  };

  useEffect(() => {
    const unsubscribe = fetchExcelsForLocation(selectedLocation, setAvailableExcels);
    return () => unsubscribe?.();
  }, [selectedLocation]);

  useEffect(() => {
    if (editingUser) {
       const unsubscribe = fetchExcelsForLocation(editSelectedLocation, setEditAvailableExcels);
       return () => unsubscribe?.();
    }
  }, [editSelectedLocation, editingUser]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const userId = self.crypto.randomUUID();
    const newUser: Omit<User, 'id'> = {
      name: formData.get("name") as string,
      username: formData.get("username") as string,
      mobile: formData.get("mobile") as string,
      location: formData.get("location") as string,
      excelFile: formData.get("excel-file") as string,
    };
    
    try {
        await set(ref(firebaseDB, `users/${userId}`), newUser);
        toast({
            title: "ID Generated",
            description: `A new ID has been successfully generated for ${newUser.name}.`,
        });
        form.reset();
        setSelectedLocation("");
    } catch (e) {
        console.error("Failed to save user to Firebase", e);
        toast({
            variant: "destructive",
            title: "Save Failed",
            description: "Could not save the new user to the database.",
        });
    }
  };

  const handleDelete = async (userId: string) => {
    try {
        await remove(ref(firebaseDB, `users/${userId}`));
        toast({
            title: "User Deleted",
            description: "The user has been successfully deleted.",
        });
    } catch(e) {
         toast({
            variant: "destructive",
            title: "Delete Failed",
            description: "Could not delete the user from the database.",
        });
    }
  };

  const openEditDialog = (user: User) => {
    setEditingUser(user);
    setEditSelectedLocation(user.location);
    setIsEditDialogOpen(true);
  };

  const handleUpdateUser = async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!editingUser) return;

      const formData = new FormData(event.currentTarget);
      const updatedUser: User = {
          ...editingUser,
          name: formData.get("name") as string,
          username: formData.get("username") as string,
          mobile: formData.get("mobile") as string,
          location: formData.get("location") as string,
          excelFile: formData.get("excel-file") as string,
      };

      try {
        const { id, ...userData } = updatedUser;
        await set(ref(firebaseDB, `users/${id}`), userData);
        toast({
            title: "User Updated",
            description: `${updatedUser.name}'s details have been successfully updated.`,
        });
        setIsEditDialogOpen(false);
        setEditingUser(null);
      } catch (e) {
          console.error("Failed to update user in Firebase", e);
          toast({
            variant: "destructive",
            title: "Update Failed",
            description: "Could not update the user in the database.",
        });
      }
  };

  return (
    <>
      <Card className="w-full">
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>Create New Identifier</CardTitle>
            <CardDescription>
              Fill out the form below to generate a new ID for a user.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="e.g., Jane Doe"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  name="username"
                  placeholder="e.g., jane.doe"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mobile">Mobile Number</Label>
                <Input
                  id="mobile"
                  name="mobile"
                  type="tel"
                  placeholder="e.g., 9876543210"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Assign Location</Label>
                <Select name="location" required onValueChange={setSelectedLocation}>
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
              </div>
              <div className="space-y-2">
                <Label htmlFor="excel-file">Assign Excel</Label>
                <Select name="excel-file" required disabled={!selectedLocation || availableExcels.length === 0}>
                  <SelectTrigger id="excel-file">
                    <SelectValue placeholder={!selectedLocation ? "Select a location first" : availableExcels.length > 0 ? "Select an Excel file" : "No files for location"} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableExcels.length > 0 ? (
                      availableExcels.map((file) => (
                        <SelectItem key={file.id} value={file.name}>
                          {file.name}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-files" disabled>
                        No Excel files uploaded for this location
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Default Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="text"
                  value="123456"
                  disabled
                  readOnly
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="border-t pt-6">
            <Button type="submit">Generate ID</Button>
          </CardFooter>
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Generated User IDs</CardTitle>
          <CardDescription>
            A list of all users for whom IDs have been created.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Full Name</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Mobile</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Assigned Excel</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center">
                    <div className="flex justify-center items-center">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading users...
                    </div>
                  </TableCell>
                </TableRow>
              ) : users.length > 0 ? (
                users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.username}</TableCell>
                    <TableCell>{user.mobile}</TableCell>
                    <TableCell>{locations.find(l => l.slug === user.location)?.name || user.location}</TableCell>
                    <TableCell>{user.excelFile}</TableCell>
                    <TableCell className="text-right space-x-2">
                       <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(user)}
                      >
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(user.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow key="no-users-row">
                  <TableCell colSpan={6} className="text-center">
                    No IDs have been generated yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

       {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[625px]">
          <form onSubmit={handleUpdateUser}>
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
              <DialogDescription>
                Make changes to the user's details below. Click save when you're done.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-name" className="text-right">Name</Label>
                <Input id="edit-name" name="name" defaultValue={editingUser?.name} className="col-span-3" required />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-username" className="text-right">Username</Label>
                <Input id="edit-username" name="username" defaultValue={editingUser?.username} className="col-span-3" required />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-mobile" className="text-right">Mobile</Label>
                <Input id="edit-mobile" name="mobile" defaultValue={editingUser?.mobile} className="col-span-3" required />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-location" className="text-right">Location</Label>
                <Select name="location" required onValueChange={setEditSelectedLocation} defaultValue={editingUser?.location}>
                  <SelectTrigger id="edit-location" className="col-span-3">
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
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-excel-file" className="text-right">Excel File</Label>
                <Select name="excel-file" required disabled={!editSelectedLocation || editAvailableExcels.length === 0} defaultValue={editingUser?.excelFile}>
                  <SelectTrigger id="edit-excel-file" className="col-span-3">
                    <SelectValue placeholder={!editSelectedLocation ? "Select a location first" : "Select an Excel file"} />
                  </SelectTrigger>
                  <SelectContent>
                    {editAvailableExcels.length > 0 ? (
                      editAvailableExcels.map((file) => (
                        <SelectItem key={file.id} value={file.name}>
                          {file.name}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-files" disabled>
                        No files for this location
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
              <Button type="submit">Save Changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
