import { Injectable, inject } from '@angular/core';
import { Auth, user } from '@angular/fire/auth';
import {
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import { Firestore } from '@angular/fire/firestore';
import { doc, setDoc } from 'firebase/firestore';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private auth = inject(Auth);
  user$: Observable<User | null> = user(this.auth);

  private firestore = inject(Firestore);

  async loginWithGoogle() {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
      prompt: 'select_account',
    });
    const cred = await signInWithPopup(this.auth, provider);
    await this.syncUserToFirestore(cred.user);
    return cred;
  }

  async loginWithEmail(email: string, pass: string) {
    return signInWithEmailAndPassword(this.auth, email, pass);
  }

  async registerWithEmail(email: string, pass: string, name: string) {
    const cred = await createUserWithEmailAndPassword(this.auth, email, pass);
    if (cred.user) {
      await updateProfile(cred.user, { displayName: name });
      // Reload user to get updated profile
      await cred.user.reload();
      await this.syncUserToFirestore(this.auth.currentUser || cred.user);
    }
    return cred;
  }

  logout() {
    return signOut(this.auth);
  }

  private async syncUserToFirestore(user: User) {
    const userDoc = doc(this.firestore, 'users', user.uid);
    await setDoc(
      userDoc,
      {
        uid: user.uid,
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
      },
      { merge: true }
    );
  }
}
