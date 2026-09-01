const mongoose = require('mongoose');

const testSchema = new mongoose.Schema({ name: String });
const Test = mongoose.model('Test', testSchema);

const doc = new Test({ name: 'hello' });
doc.permissions = ['*'];

console.log('doc.permissions:', doc.permissions);
console.log('JSON permissions:', doc.toJSON().permissions);

const plain = doc.toObject();
plain.permissions = ['*'];
console.log('plain.permissions:', plain.permissions);
