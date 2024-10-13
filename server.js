import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const firestore = admin.firestore();

function getDataStructure(data, path = '', depth = 0, limit = 3) {
  if (depth > 10) return 'Max depth reached';
  
  if (typeof data !== 'object' || data === null) return typeof data;
  
  const structure = {};
  for (const [key, value] of Object.entries(data).slice(0, limit)) {
    structure[key] = getDataStructure(value, `${path}/${key}`, depth + 1, limit);
  }
  return structure;
}

async function migrateData(data, firestoreRef, structure, userChoices, path = '') {
  for (const [key, value] of Object.entries(data)) {
    const choice = userChoices[`${path}/${key}`];
    
    if (choice === 'skip') continue;
    
    if (choice === 'collection') {
      await migrateData(value, firestoreRef.collection(key), structure[key], userChoices, `${path}/${key}`);
    } else if (choice === 'document') {
      await firestoreRef.doc(key).set(value);
    } else if (choice === 'field') {
      await firestoreRef.update({ [key]: value });
    }
  }
}

app.post('/api/upload', upload.single('file'), (req, res) => {
  try {
    const jsonData = JSON.parse(req.file.buffer.toString());
    const structure = getDataStructure(jsonData);
    res.json({ structure });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/migrate', async (req, res) => {
  try {
    const { jsonData, userChoices } = req.body;
    const structure = getDataStructure(jsonData);
    await migrateData(jsonData, firestore, structure, userChoices);
    res.json({ message: 'Migration completed successfully!' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});