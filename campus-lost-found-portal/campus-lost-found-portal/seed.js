/**
 * seed.js - fills the database with demo data.
 *
 *   npm run seed            add the demo records if the database is empty
 *   npm run seed -- --force wipe the collections first
 */
require('dotenv').config();

const mongoose = require('mongoose');
const connectDB = require('./src/config/db');
const User = require('./src/models/User');
const Item = require('./src/models/Item');
const Claim = require('./src/models/Claim');
const Notification = require('./src/models/Notification');

const daysAgo = (days) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(10, 0, 0, 0);
  return date;
};

const USERS = [
  {
    name: 'Campus Security Desk',
    email: 'admin@campus.edu',
    password: 'Admin@12345',
    role: 'admin',
    department: 'Security Office',
  },
  {
    name: 'Aditi Sharma',
    email: 'aditi@campus.edu',
    password: 'Student@123',
    role: 'student',
    department: 'Computer Science',
  },
  {
    name: 'Rohan Verma',
    email: 'rohan@campus.edu',
    password: 'Student@123',
    role: 'student',
    department: 'Electronics',
  },
  {
    name: 'Meera Iyer',
    email: 'meera@campus.edu',
    password: 'Student@123',
    role: 'student',
    department: 'Design',
  },
];

const ITEMS = [
  {
    title: 'Black Dell laptop bag with a broken zip',
    description:
      'Left my black laptop bag on the second floor of the library near the window seats. It has a broken left zip, a blue notebook inside and a small keychain shaped like a rocket.',
    category: 'bags',
    type: 'lost',
    location: 'library',
    dateLostOrFound: daysAgo(1),
    reporter: 'aditi@campus.edu',
  },
  {
    title: 'Blue water bottle found near the canteen counter',
    description:
      'A blue stainless steel water bottle was left on the table closest to the canteen counter after lunch. There is a sticker of a mountain on the base.',
    category: 'other',
    type: 'found',
    location: 'canteen',
    dateLostOrFound: daysAgo(1),
    reporter: 'rohan@campus.edu',
  },
  {
    title: 'Student ID card in the name of R. Verma',
    description:
      'Found a student ID card on the walkway between the main gate and academic block A. The card is inside a clear plastic sleeve with a lanyard attached.',
    category: 'id-cards',
    type: 'found',
    location: 'main-gate',
    dateLostOrFound: daysAgo(2),
    reporter: 'meera@campus.edu',
  },
  {
    title: 'Lost my silver iPhone 13 with a cracked screen',
    description:
      'I lost my silver iPhone 13 somewhere between the sports complex and the hostel block. The screen has a crack in the top right corner and the wallpaper is a sunset.',
    category: 'electronics',
    type: 'lost',
    location: 'sports-complex',
    dateLostOrFound: daysAgo(3),
    reporter: 'rohan@campus.edu',
  },
  {
    title: 'Bunch of keys with a red carabiner',
    description:
      'Three keys on a red carabiner ring were found on a bench outside the auditorium after the morning assembly. One key has a small green tag.',
    category: 'keys',
    type: 'found',
    location: 'auditorium',
    dateLostOrFound: daysAgo(3),
    reporter: 'aditi@campus.edu',
  },
  {
    title: 'Data Structures textbook left in block B classroom',
    description:
      'A copy of Data Structures and Algorithms by Cormen was left behind in classroom B-204. The name Aditi is written on the inside cover in blue ink.',
    category: 'books',
    type: 'found',
    location: 'academic-block-b',
    dateLostOrFound: daysAgo(4),
    reporter: 'meera@campus.edu',
  },
  {
    title: 'Lost a navy blue hoodie in the hostel common room',
    description:
      'My navy blue hoodie with a white logo on the chest went missing from the hostel common room on Friday night. Size medium, the drawstring on the left is torn.',
    category: 'clothing',
    type: 'lost',
    location: 'hostel',
    dateLostOrFound: daysAgo(5),
    reporter: 'meera@campus.edu',
  },
  {
    title: 'Wireless earbuds case found in the parking area',
    description:
      'A white wireless earbuds charging case was found near the two-wheeler parking rows. It has a small scratch on the lid and no earbuds inside.',
    category: 'electronics',
    type: 'found',
    location: 'parking',
    dateLostOrFound: daysAgo(6),
    reporter: 'rohan@campus.edu',
  },
  {
    title: 'Prescription glasses with a thin gold frame',
    description:
      'I lost my prescription glasses with a thin gold frame, probably in academic block A during the afternoon lecture. They were in a brown hard case.',
    category: 'accessories',
    type: 'lost',
    location: 'academic-block-a',
    dateLostOrFound: daysAgo(7),
    reporter: 'aditi@campus.edu',
  },
  {
    title: 'Grey umbrella found at the library entrance',
    description:
      'A grey folding umbrella was left in the umbrella stand at the library entrance. The handle is wooden and there is a small tear near one of the ribs.',
    category: 'other',
    type: 'found',
    location: 'library',
    dateLostOrFound: daysAgo(8),
    reporter: 'meera@campus.edu',
  },
  {
    title: 'Lost a black Casio wristwatch in the canteen',
    description:
      'My black Casio digital wristwatch with a resin strap went missing in the canteen during the lunch rush. The display has a faint scratch across the middle.',
    category: 'accessories',
    type: 'lost',
    location: 'canteen',
    dateLostOrFound: daysAgo(9),
    reporter: 'rohan@campus.edu',
  },
  {
    title: 'Notebook with graph sheets found in block A',
    description:
      'A spiral notebook full of hand-drawn graph sheets was found on the first floor of academic block A. The cover is plain brown with no name written on it.',
    category: 'books',
    type: 'found',
    location: 'academic-block-a',
    dateLostOrFound: daysAgo(10),
    reporter: 'aditi@campus.edu',
  },
];

(async () => {
  const force = process.argv.includes('--force');

  try {
    await connectDB();

    const existing = await Item.countDocuments();
    if (existing && !force) {
      console.log(`Database already has ${existing} listings. Run "npm run seed -- --force" to reset.`);
      await mongoose.disconnect();
      return;
    }

    if (force) {
      await Promise.all([
        User.deleteMany({}),
        Item.deleteMany({}),
        Claim.deleteMany({}),
        Notification.deleteMany({}),
      ]);
      console.log('Cleared users, items, claims and notifications.');
    }

    const createdUsers = {};
    for (const user of USERS) {
      // create() runs the bcrypt hook, so seeded logins work exactly like real ones.
      const doc = await User.create(user);
      createdUsers[user.email] = doc;
    }
    console.log(`Created ${Object.keys(createdUsers).length} users.`);

    const createdItems = [];
    for (const item of ITEMS) {
      const doc = await Item.create({
        ...item,
        reporter: createdUsers[item.reporter]._id,
      });
      createdItems.push(doc);
    }
    console.log(`Created ${createdItems.length} listings.`);

    // One pending claim so the dashboard has something to decide on.
    const claimItem = createdItems.find((item) => item.title.includes('water bottle'));
    const claim = await Claim.create({
      item: claimItem._id,
      claimant: createdUsers['aditi@campus.edu']._id,
      message:
        'That is my bottle, it has a mountain sticker on the base and my initials are scratched under it.',
      proof: 'Initials AS scratched near the base',
    });

    await Notification.create({
      user: claimItem.reporter,
      type: 'claim',
      message: `Aditi Sharma submitted a claim on "${claimItem.title}"`,
      item: claimItem._id,
      claim: claim._id,
    });

    console.log('Created 1 pending claim and its notification.\n');
    console.log('Demo logins');
    console.log('  admin    admin@campus.edu   Admin@12345');
    console.log('  student  aditi@campus.edu   Student@123');
    console.log('  student  rohan@campus.edu   Student@123\n');

    await mongoose.disconnect();
  } catch (error) {
    console.error('Seed failed:', error.message);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  }
})();
