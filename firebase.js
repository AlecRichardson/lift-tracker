import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDPRS8sEsvVCuMl0DpM2xKlX_G_fEizzmE",
  authDomain: "lift-tracker-8674a.firebaseapp.com",
  projectId: "lift-tracker-8674a",
  storageBucket: "lift-tracker-8674a.firebasestorage.app",
  messagingSenderId: "423500232178",
  appId: "1:423500232178:web:5413feefa5da27997b676b",
  measurementId: "G-V7SM6L4Z8M"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };
