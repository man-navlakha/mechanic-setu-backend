# Vehicle RC Information API

## Overview
This API allows you to fetch vehicle registration certificate (RC) information using a vehicle registration number. The data is fetched from RapidAPI's Vehicle RC Information service.

## Endpoint

### Get Vehicle RC Information

**POST** `/api/vehicle/rc-info`

Retrieves detailed registration certificate information for a given vehicle number.

#### Request Body
```json
{
  "vehicle_number": "GJ27AA3978"
}
```

**Parameters:**
- `vehicle_number` (string, required): The vehicle registration number in the format: `XX00XX0000` 
  - First 2 characters: State code (e.g., GJ, MH, DL)
  - Next 1-2 digits: RTO code
  - Next 0-3 characters: Series (optional)
  - Last 4 digits: Unique number

#### Response - Success (200)
```json
{
  "success": true,
  "data": {
    // Vehicle RC information from RapidAPI
    // Structure depends on the API response
  }
}
```

#### Response - Validation Error (400)
```json
{
  "success": false,
  "error": "Vehicle number is required"
}
```

or

```json
{
  "success": false,
  "error": "Invalid vehicle number format. Expected format: GJ27AA3978"
}
```

#### Response - Server Error (500)
```json
{
  "success": false,
  "error": "Failed to fetch vehicle information",
  "message": "Error details..."
}
```

## Configuration

### Environment Variables

Add the following to your `.env` file:

```bash
RAPIDAPI_KEY=your_primary_rapidapi_key_here
RAPIDAPI_KEY_BACKUP=your_backup_rapidapi_key_here
RAPIDAPI_KEY_BACKUP_1=your_second_backup_rapidapi_key_here
```

**Current Keys:** Available in `.env` file

### API Key Fallback

The system automatically implements a **multi-tier fallback mechanism** for API keys:

1. **Chain of Keys**: The system sequentially tries `RAPIDAPI_KEY`, then `RAPIDAPI_KEY_BACKUP`, and finally `RAPIDAPI_KEY_BACKUP_1`.
2. **Quota Detection**: If a key has exceeded its daily quota, the system automatically detects the error message.
3. **Automatic Fallback**: The system immediately retries the request with the next available key in the chain.
4. **Response Indicator**: The response includes a `used_backup_key` field to indicate which key was used

**Example Response with Backup Key:**
```json
{
  "success": true,
  "data": { /* vehicle data */ },
  "saved_to_db": true,
  "db_id": 123,
  "used_backup_key": true
}
```

This ensures **zero downtime** when API quotas are exceeded!

## Usage Examples

### cURL
```bash
curl -X POST http://localhost:3000/api/vehicle/rc-info \
  -H "Content-Type: application/json" \
  -d '{"vehicle_number": "GJ27AA3978"}'
```

### JavaScript (Fetch)
```javascript
const response = await fetch('http://localhost:3000/api/vehicle/rc-info', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    vehicle_number: 'GJ27AA3978'
  })
});

const data = await response.json();
console.log(data);
```

### Axios
```javascript
const axios = require('axios');

const response = await axios.post('http://localhost:3000/api/vehicle/rc-info', {
  vehicle_number: 'GJ27AA3978'
});

console.log(response.data);
```

## Implementation Details

### Files Created
- **Controller**: `api/controller/vehicleController.js` - Handles business logic
- **Routes**: `api/routes/vehicleRoutes.js` - Defines API endpoints
- **Documentation**: `docs/vehicle-api.md` - This file

### Integration
The vehicle routes are integrated into the main Express app in `api/index.js`:
```javascript
const vehicleRoutes = require('./routes/vehicleRoutes');
app.use('/api/vehicle', vehicleRoutes);
```

## Testing

### Test with Sample Vehicle Number
```bash
# Using curl
curl -X POST http://localhost:3000/api/vehicle/rc-info \
  -H "Content-Type: application/json" \
  -d '{"vehicle_number": "GJ27AA3978"}'
```

### Common Test Cases
1. **Valid vehicle number**: Should return success with vehicle data
2. **Invalid format**: Should return 400 error
3. **Missing vehicle number**: Should return 400 error
4. **Network error**: Should return 500 error

## Error Handling

The API includes comprehensive error handling for:
- Missing or invalid input
- Invalid vehicle number format
- Network errors
- API errors from RapidAPI
- JSON parsing errors

## Notes

- Vehicle numbers are automatically converted to uppercase
- Basic validation is performed on the format before calling the external API
- The API uses HTTPS for secure communication with RapidAPI
- Response structure from RapidAPI may vary based on the vehicle data available

## RapidAPI Information

**Service**: Vehicle RC Information V2  
**Host**: vehicle-rc-information-v2.p.rapidapi.com  
**Documentation**: Available on RapidAPI marketplace

## Support

For issues or questions, please refer to:
- RapidAPI documentation for Vehicle RC Information V2
- Project README at `README.md`
