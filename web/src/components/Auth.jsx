import React, { useEffect, useState } from 'react';
import { auth } from '../firebase';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from 'firebase/auth';
import { toast } from 'react-toastify';
import { confirmAlert } from 'react-confirm-alert';
import 'react-confirm-alert/src/react-confirm-alert.css';

const AuthButton = () => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      toast.success("Logged in successfully");
    } catch (error) {
      console.error('Login failed:', error);
      toast.error("Login failed");
    }
  };

  const handleLogout = () => {
    confirmAlert({
      title: 'Logout',
      message: 'Are you sure you want to logout?',
      buttons: [
        {
          label: 'Yes',
          onClick: async () => {
            try {
                await signOut(auth);
                toast.success("Logged out successfully");
            } catch (error) {
                toast.error("Logout failed");
            }
        }
        },
        {
          label: 'No'
        }
      ]
    });
  };

  return (
    <button
        className="btn-outline-primary rounded-circle border-0"
        onClick={user ? handleLogout : handleLogin}
        title={user ? 'Logout' : 'Login with Google'}
        style={{
          width: '40px',
          height: '40px',
          padding: 0,
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <img
          src={user ? user.photoURL : "https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"}
          alt={user ? user.displayName : "Google Sign-In"}
          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
        />
    </button>
  );
};

export default AuthButton;
