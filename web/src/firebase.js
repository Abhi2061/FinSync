// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from 'firebase/firestore';


const firebaseConfig = {
  apiKey: "AIzaSyBaNknNO_3zH3DRzyAb6ZaDjs_v_b1EB3I",
  authDomain: "finsync-abhi2061.firebaseapp.com",
  projectId: "finsync-abhi2061",
  storageBucket: "finsync-abhi2061.firebasestorage.app",
  messagingSenderId: "626252229559",
  appId: "1:626252229559:web:2ccf2adaa5f08c448bd632",
  measurementId: "G-5RFHFHY461"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;