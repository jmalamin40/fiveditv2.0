# Seeding Note

⚠️ **Important**: The seeding scripts (`seed.js` and `reseed.js`) require the JSON data files to populate the database.

If you've deleted the JSON files from the `data/` directory, you have two options:

## Option 1: Restore JSON files from Git
```bash
git checkout data/
```

## Option 2: Seed from existing database
If you already have data in your database, you can skip seeding. The API will work with existing database data.

## Option 3: Manual data entry
You can manually insert data into the database using SQL or a database management tool.

## Note
The JSON files are only needed for initial seeding. Once the database is populated, the application runs entirely from the MySQL database via the API.

