import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBmDodW5TUNsne2UKw_-d5RK4MhFgo_0yc",
  authDomain: "cipher-saga-2.firebaseapp.com",
  projectId: "cipher-saga-2",
  storageBucket: "cipher-saga-2.firebasestorage.app",
  messagingSenderId: "1003412882011",
  appId: "1:1003412882011:web:4f665b7ea936113e39757e",
  measurementId: "G-XNBBT1EPXL"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const db = getFirestore();
export const auth = getAuth();
export const storage = getStorage();
