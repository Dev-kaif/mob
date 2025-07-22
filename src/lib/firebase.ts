// Import the functions you need from the SDKs you need
import { initializeApp, getApp, getApps } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAUCx23ZWyV-ppL8dvYxA-VpHgUeZybvVE",
  authDomain: "admin-central-gma0r.firebaseapp.com",
  databaseURL: "https://admin-central-gma0r-default-rtdb.firebaseio.com",
  projectId: "admin-central-gma0r",
  storageBucket: "admin-central-gma0r.appspot.com",
  messagingSenderId: "593402882406",
  appId: "1:593402882406:web:7bc7dd231241b957e300a7"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getDatabase(app);
const storage = getStorage(app);

export { app, db, storage };
