# Fiverr Reviews - Bulk Import Guide

This guide will help you add your 50+ Fiverr reviews to the website efficiently.

## File Location
`/data/fiverr-reviews.json`

## Quick Start: Adding Reviews in Bulk

### Option 1: Manual Entry (Recommended for accuracy)

1. Open `fiverr-reviews.json` in your code editor
2. Copy the structure below for each review
3. Paste and fill in the details

### Option 2: CSV to JSON Conversion

If you have your reviews in a spreadsheet:

1. Export from Fiverr or create a CSV with columns:
   - reviewerName
   - reviewerInitial
   - location
   - countryCode
   - isRepeatClient (true/false)
   - rating (1-5)
   - timePosted
   - reviewText
   - priceRange
   - duration

2. Use an online CSV to JSON converter
3. Copy the JSON array into the `reviews` array

## Review Structure

```json
{
  "id": 1,
  "reviewerName": "clientname",
  "reviewerInitial": "C",
  "location": "United States",
  "countryCode": "US",
  "isRepeatClient": false,
  "rating": 5,
  "timePosted": "2 months ago",
  "reviewText": "Your review text here",
  "priceRange": "$50-$100",
  "duration": "1 day",
  "helpfulCount": 0
}
```

## Field Descriptions

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| **id** | number | Unique ID (increment sequentially) | 1, 2, 3... |
| **reviewerName** | string | Client's Fiverr username | "johnsmith" |
| **reviewerInitial** | string | First letter of username | "J" |
| **location** | string | Country name | "United States" |
| **countryCode** | string | ISO 2-letter country code | "US" |
| **isRepeatClient** | boolean | Has ordered multiple times | true or false |
| **rating** | number | Star rating (1-5) | 5 |
| **timePosted** | string | Relative time | "6 months ago" |
| **reviewText** | string | The review text | "Great work!" |
| **priceRange** | string | Order price range | "$100-$200" |
| **duration** | string | Delivery time | "1 day" |
| **helpfulCount** | number | Starting helpful count | 0 |

## Country Codes Reference

Common country codes (more supported in component):

- **US** - United States 🇺🇸
- **GB** - United Kingdom 🇬🇧
- **CA** - Canada 🇨🇦
- **AU** - Australia 🇦🇺
- **DE** - Germany 🇩🇪
- **FR** - France 🇫🇷
- **IT** - Italy 🇮🇹
- **ES** - Spain 🇪🇸
- **NL** - Netherlands 🇳🇱
- **IN** - India 🇮🇳
- **BR** - Brazil 🇧🇷
- **MX** - Mexico 🇲🇽
- **JP** - Japan 🇯🇵
- **KR** - South Korea 🇰🇷
- **CN** - China 🇨🇳
- **SG** - Singapore 🇸🇬
- **AE** - United Arab Emirates 🇦🇪
- **SA** - Saudi Arabia 🇸🇦
- **ZA** - South Africa 🇿🇦
- **NG** - Nigeria 🇳🇬

For other countries, use the ISO 2-letter code. A generic 🌍 flag will display.

## How to Extract Reviews from Fiverr

### Method 1: Manual Copy-Paste
1. Go to your Fiverr profile page
2. Scroll to the reviews section
3. For each review, copy:
   - Username
   - Location (hover over flag icon)
   - Rating (count the stars)
   - Review text
   - Time posted
   - Order price (if visible)
   - Delivery time (if visible)
   - Check if "Repeat Client" badge is shown

### Method 2: Browser Developer Tools
1. Open your Fiverr reviews page
2. Press F12 to open Developer Tools
3. Look for review data in the Network tab or Elements
4. Extract JSON data if available

## Tips for Bulk Adding

1. **Start with most recent reviews** - They're usually more relevant
2. **Group by client** - If a client has multiple reviews, mark them as repeat clients
3. **Be consistent with time format** - Use "X months ago" or "X years ago"
4. **Price ranges** - Use formats like "$50-$100" or "Up to $50"
5. **Duration** - Use "1 day", "2 days", "1 week", etc.

## Example: Adding 10 Reviews at Once

```json
{
  "reviews": [
    {
      "id": 1,
      "reviewerName": "client1",
      "reviewerInitial": "C",
      "location": "United States",
      "countryCode": "US",
      "isRepeatClient": false,
      "rating": 5,
      "timePosted": "1 month ago",
      "reviewText": "Excellent work!",
      "priceRange": "$100-$200",
      "duration": "1 day",
      "helpfulCount": 0
    },
    {
      "id": 2,
      "reviewerName": "client2",
      "reviewerInitial": "C",
      "location": "Germany",
      "countryCode": "DE",
      "isRepeatClient": true,
      "rating": 5,
      "timePosted": "2 months ago",
      "reviewText": "Great service!",
      "priceRange": "Up to $50",
      "duration": "1 day",
      "helpfulCount": 0
    }
    // ... add 8 more reviews
  ]
}
```

## Features Available

Once reviews are added, the component provides:

- ✅ **Pagination** - 10 reviews per page
- ✅ **Search** - Search by review text, name, or location
- ✅ **Filter by Rating** - Show only 5-star, 4-star, etc.
- ✅ **Filter by Client Type** - Repeat clients or new clients
- ✅ **Sort Options** - Newest, oldest, or highest rated
- ✅ **Auto-calculated Stats** - Total reviews, average rating, repeat clients, satisfaction rate

## Validation

Before saving, make sure:
- All IDs are unique and sequential
- All required fields are filled
- Country codes are valid 2-letter codes
- Ratings are between 1 and 5
- JSON syntax is valid (use a JSON validator)

## Need Help?

If you have reviews in another format (CSV, Excel, etc.), you can:
1. Convert to JSON using online tools
2. Or provide the data and I can help format it
