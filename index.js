require('dotenv').config();
const admin = require('firebase-admin');
const inquirer = require('inquirer');
const serviceAccount = require(process.env.FIREBASE_PRIVATE_KEY_PATH);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`
});

const db = admin.database();
const firestore = admin.firestore();

async function getDataStructure(ref, path = '', depth = 0, limit = 3) {
  if (depth > 10) return 'Max depth reached';
  
  const snapshot = await ref.limitToFirst(limit).once('value');
  const data = snapshot.val();
  
  if (data === null) return null;
  if (typeof data !== 'object') return typeof data;
  
  const structure = {};
  for (const [key, value] of Object.entries(data)) {
    structure[key] = await getDataStructure(ref.child(key), `${path}/${key}`, depth + 1, limit);
  }
  return structure;
}

async function promptUserForStructure(structure, path = '') {
  const choices = [
    { name: 'Collection', value: 'collection' },
    { name: 'Document', value: 'document' },
    { name: 'Skip', value: 'skip' }
  ];

  const questions = Object.entries(structure).map(([key, value]) => ({
    type: 'list',
    name: `${path}/${key}`,
    message: `How should "${key}" be treated?`,
    choices: typeof value === 'object' ? choices : [{ name: 'Field', value: 'field' }]
  }));

  const answers = await inquirer.prompt(questions);
  return answers;
}

async function migrateData(realtimeRef, firestoreRef, structure, userChoices) {
  const snapshot = await realtimeRef.once('value');
  const data = snapshot.val();

  for (const [key, value] of Object.entries(data)) {
    const choice = userChoices[`${realtimeRef.path}/${key}`];
    
    if (choice === 'skip') continue;
    
    if (choice === 'collection') {
      await migrateData(realtimeRef.child(key), firestoreRef.collection(key), structure[key], userChoices);
    } else if (choice === 'document') {
      await firestoreRef.doc(key).set(value);
    } else if (choice === 'field') {
      await firestoreRef.update({ [key]: value });
    }
  }
}

async function main() {
  try {
    console.log('Analyzing data structure...');
    const structure = await getDataStructure(db.ref('/'));
    console.log('Data structure:', JSON.stringify(structure, null, 2));

    const userChoices = await promptUserForStructure(structure);
    console.log('User choices:', userChoices);

    console.log('Starting migration...');
    await migrateData(db.ref('/'), firestore, structure, userChoices);
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Error during migration:', error);
  } finally {
    admin.app().delete();
  }
}

main();