
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, User as UserIcon, Loader2 } from "lucide-react";
import { db as firebaseDB } from "@/lib/firebase";
import { ref, get } from "firebase/database";
import { login } from "@/app/actions";

interface User {
  id: string;
  name: string;
  username: string;
  mobile: string;
  location: string;
  excelFile: string;
}

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [role, setRole] = useState("admin");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = async () => {
    setError("");
    setIsLoggingIn(true);

    try {
      if (role === "admin") {
        if (username === "superadmin" && password === "123456") {
          const user = { role: "admin", name: "Super Admin", username: "superadmin" };
          await login(user);
          localStorage.setItem("loggedInUser", JSON.stringify(user));
          toast({
            title: "Login Successful",
            description: "Welcome back, Admin!",
          });
          router.push("/");
          router.refresh();
        } else {
          setError("Invalid admin username or password.");
          toast({
            variant: "destructive",
            title: "Admin Login Failed",
            description: "Invalid admin username or password.",
          });
        }
      } else if (role === "user") {
        // Fetch all users and filter on the client to avoid indexing issues
        const usersRef = ref(firebaseDB, 'users');
        const snapshot = await get(usersRef);

        if (snapshot.exists()) {
            const usersData = snapshot.val();
            let foundUser: User | null = null;
            let userId: string | null = null;

            // Client-side filtering
            for (const id in usersData) {
                if (usersData[id].username === username) {
                    userId = id;
                    foundUser = { id, ...usersData[id] };
                    break;
                }
            }
            
            if (foundUser && userId && password === "123456") {
                 const user = { role: "user", ...foundUser };
                 await login(user);
                 localStorage.setItem("loggedInUser", JSON.stringify(user));
                 toast({
                    title: "Login Successful",
                    description: `Welcome, ${foundUser.name}!`,
                });
                router.push("/user/dashboard");
                router.refresh();
            } else {
                 setError("Invalid username or password.");
                 toast({
                    variant: "destructive",
                    title: "Login Failed",
                    description: "Invalid username or password.",
                  });
            }
        } else {
          setError("Invalid username or password.");
          toast({
            variant: "destructive",
            title: "Login Failed",
            description: "No users found in the database.",
          });
        }
      }
    } catch (e) {
      console.error("Firebase login error", e);
      setError("An error occurred during login.");
       toast({
          variant: "destructive",
          title: "Login Error",
          description: "Could not retrieve user data from the server.",
        });
    } finally {
        setIsLoggingIn(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary">
            {role === 'admin' ? <ShieldCheck className="h-10 w-10 text-primary-foreground" /> : <UserIcon className="h-10 w-10 text-primary-foreground" />}
          </div>
          <CardTitle className="text-2xl font-bold">
            {role === 'admin' ? 'Admin Central' : 'User Login'}
          </CardTitle>
          <CardDescription>
            {role === 'admin' ? 'Enter your super admin credentials to access the dashboard.' : 'Enter your credentials to access your dashboard.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder={role === 'admin' ? 'superadmin' : 'e.g., mukesh'}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={isLoggingIn}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoggingIn}
              />
            </div>
            {error && (
              <p className="text-sm font-medium text-destructive">{error}</p>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button className="w-full" onClick={handleLogin} disabled={isLoggingIn}>
            {isLoggingIn ? <Loader2 className="animate-spin" /> : 'Sign In'}
          </Button>
          <Button
            variant="link"
            size="sm"
            onClick={() => {
              setRole(role === 'admin' ? 'user' : 'admin');
              setError('');
              setUsername('');
              setPassword('');
            }}
            disabled={isLoggingIn}
          >
            {role === 'admin' ? 'Switch to User Login' : 'Switch to Admin Login'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
