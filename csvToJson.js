const fs = require('fs');
const { parse } = require('csv-parse/sync');

// Read the CSV file
const csvData = fs.readFileSync('data.csv', 'utf-8');

// Parse CSV to JSON
const records = parse(csvData, {
  columns: true,
  skip_empty_lines: true
});

// Convert to the desired format
const formattedData = records.map(record => ({
  id: record.id,
  name: record.name,
  description: record.description,
  price: parseFloat(record.price),
  category: record.category,
  image: record.image,
  quantity: parseInt(record.quantity, 10)
}));

// Write to JSON file
fs.writeFileSync('products.json', JSON.stringify(formattedData, null, 2));

console.log('Conversion completed! Check products.json for the result.'); 