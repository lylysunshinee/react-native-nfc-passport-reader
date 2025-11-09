# NFC Passport Reader for React Native (Vietnam CCCD Support)

This React Native plugin enables the reading of NFC-enabled passports and **Vietnam CCCD (Căn cước công dân)** cards using native device capabilities. It provides a user-friendly interface for initiating and handling NFC operations, including reading passport data, checking NFC support, and managing NFC settings.

## Features

- ✅ Start and stop NFC passport reading
- ✅ Basic Access Control (BAC) support for secure passport reading
- ✅ **Vietnam CCCD (Căn cước công dân) support** - handles cards without DG11
- ✅ **EF.SOD (Security Object Document)** extraction for data verification
- ✅ Check if NFC is supported and enabled on the device
- ✅ Open device NFC settings
- ✅ Support for both iOS and Android platforms
- ✅ Optional image extraction from passport/ID card
- ✅ MRZ data fallback for Vietnam CCCD cards

## Installation

To use the NFC Passport Reader in your React Native project, follow these steps:

1. **Install the Plugin**:
   ```sh
   npm install git+https://github.com/lylysunshinee/react-native-nfc-passport-reader.git
   ```

   Or add to your `package.json`:
   ```json
   {
     "dependencies": {
       "react-native-nfc-passport-reader": "git+https://github.com/lylysunshinee/react-native-nfc-passport-reader.git"
     }
   }
   ```
2. **Link Native Modules (if required for versions below React Native 0.60)**:
   ```sh
   npx react-native link react-native-nfc-passport-reader
   ```
3. **iOS Additional Setup**:
   - Modify your Info.plist to include necessary NFC usage descriptions.
     ```xml
     <key>NFCReaderUsageDescription</key>
     <string>This app requires NFC access to verify your identity.</string>
     <key>com.apple.developer.nfc.readersession.iso7816.select-identifiers</key>
     <array>
        <string>A0000002471001</string>
        <string>00000000000000</string>
        <string>D4100000030001</string>
     </array>
     ```
   - Ensure your entitlements include NFC tag reading capability.
   - Add the following pod to your Podfile:
     ```ruby
     pod 'OpenSSL-Universal', '~> 1.1.1900'
     ```
   - Disable Flipper in your Podfile (required for proper functionality)

4. **Android Additional Setup**:
   - Add NFC permissions in your AndroidManifest.xml.
     ```xml
     <uses-feature android:name="android.hardware.nfc" android:required="false" />
     <uses-permission android:name="android.permission.NFC" />
     ```
   - Ensure your device has NFC capabilities and that NFC is enabled.

## Usage

Import and use the NFC Passport Reader as follows:

```ts
import NfcPassportReader from 'react-native-nfc-passport-reader';
import type { NfcResult } from 'react-native-nfc-passport-reader';
```

### Basic Methods

- **startReading**: Initiates the NFC passport reading process.

  **For International Passports:**
  ```ts
  const result: NfcResult = await NfcPassportReader.startReading({
    bacKey: {
      documentNo: '123456789', // Passport Number
      expiryDate: '2025-03-09', // YYYY-MM-DD
      birthDate: '1990-01-15', // YYYY-MM-DD
    },
    includeImages: true, // Include images in the result (default: false)
  });
  ```

  **For Vietnam CCCD (Căn cước công dân):**
  ```ts
  const result: NfcResult = await NfcPassportReader.startReading({
    bacKey: {
      documentNo: '093009672123', // 12-digit CCCD number
      expiryDate: '2033-11-01',   // YYYY-MM-DD (expiry date on card)
      birthDate: '1993-11-01',    // YYYY-MM-DD (date of birth)
    },
    includeImages: true, // Include face photo from CCCD
  });
  ```

  **⚠️ Important:** The BAC key must match EXACTLY with the information on the card. Even one wrong character will cause authentication to fail with error `SW = 0x6300: Mutual authentication failed`.
- **stopReading**: Stops the NFC passport reading process. ***(Only Android)***
  ```ts
  NfcPassportReader.stopReading();
  ```

### Event Listeners (Only Android)

- **addOnTagDiscoveredListener**: Triggers when an NFC tag is discovered.
  ```ts
  NfcPassportReader.addOnTagDiscoveredListener(() => {
    console.log('Tag Discovered');
  });
  ```
- **addOnNfcStateChangedListener**: Monitors changes in NFC state.
  ```ts
  NfcPassportReader.addOnNfcStateChangedListener((state: 'on' | 'off') => {
    console.log('NFC State Changed:', state);
  });
  ```

### Check Device Support

- **isNfcSupported**: Checks if NFC is supported by the device.
  ```ts
  const supported = await NfcPassportReader.isNfcSupported();
  ```
- **isNfcEnabled**: Checks if NFC is enabled on the device.
  ```ts
  const enabled = await NfcPassportReader.isNfcEnabled();
  ```

### Settings

- **openNfcSettings**: Opens the device's NFC settings. ***(Only Android)***
  ```ts
  NfcPassportReader.openNfcSettings();
  ```

## NfcResult Type

The `NfcResult` object returned from `startReading` contains:

```ts
type NfcResult = {
  birthDate: string;           // Date of birth (YYYY-MM-DD)
  placeOfBirth?: string;       // Place of birth (may not be available for Vietnam CCCD)
  documentNo: string;          // Document/CCCD number
  expiryDate: string;          // Expiry date (YYYY-MM-DD)
  firstName: string;           // First name
  gender: string;              // Gender (M/F)
  identityNo?: string;         // Personal number / SOB (Số định danh)
  lastName: string;            // Last name
  mrz: string;                 // Full MRZ string
  nationality: string;         // Nationality code (e.g., VNM for Vietnam)
  originalFacePhoto?: string;  // Base64-encoded face photo (if includeImages: true)
  sod?: string;                // EF.SOD (Security Object Document) as base64 - for verification
};
```

### Vietnam CCCD Notes

Vietnam CCCD cards differ from international passports:
- ❌ **No DG11**: CCCD cards don't contain Data Group 11 (additional details)
- ✅ **MRZ Fallback**: The library automatically uses MRZ data for name and birth date when DG11 is unavailable
- ✅ **SOD Support**: EF.SOD is available for data integrity verification
- ✅ **Face Photo**: DG2 contains the face photo (available with `includeImages: true`)

## Example

For a detailed example of how to use the NFC Passport Reader, please see the [Example App](Example/src/App.tsx).

### Complete Example for Vietnam CCCD

```tsx
import React, { useState } from 'react';
import { View, Button, Text } from 'react-native';
import NfcPassportReader from 'react-native-nfc-passport-reader';
import type { NfcResult } from 'react-native-nfc-passport-reader';

export default function App() {
  const [result, setResult] = useState<NfcResult | null>(null);
  const [scanning, setScanning] = useState(false);

  const scanCCCD = async () => {
    try {
      setScanning(true);
      const nfcResult = await NfcPassportReader.startReading({
        bacKey: {
          documentNo: '093009672123',  // Replace with actual CCCD number
          birthDate: '1993-11-01',     // Replace with actual birth date
          expiryDate: '2033-11-01',    // Replace with actual expiry date
        },
        includeImages: true,
      });

      setResult(nfcResult);
      console.log('CCCD Data:', nfcResult);

      // Access SOD for verification if needed
      if (nfcResult.sod) {
        console.log('SOD length:', nfcResult.sod.length);
      }
    } catch (error) {
      console.error('Error reading CCCD:', error);
    } finally {
      setScanning(false);
    }
  };

  return (
    <View style={{ padding: 20 }}>
      <Button title="Scan CCCD" onPress={scanCCCD} disabled={scanning} />

      {result && (
        <View style={{ marginTop: 20 }}>
          <Text>Name: {result.lastName} {result.firstName}</Text>
          <Text>Date of Birth: {result.birthDate}</Text>
          <Text>CCCD No: {result.documentNo}</Text>
          <Text>Gender: {result.gender}</Text>
          <Text>Nationality: {result.nationality}</Text>
          {result.identityNo && <Text>SOB: {result.identityNo}</Text>}
        </View>
      )}
    </View>
  );
}
```

## Troubleshooting

### Common Errors for Vietnam CCCD

#### Error: `SW = 0x6300: Mutual authentication failed`

**Cause:** The BAC key information doesn't match the CCCD card exactly.

**Solution:**
- Double-check the `documentNo` (must be exactly 12 digits)
- Verify the `birthDate` (format: YYYY-MM-DD)
- Verify the `expiryDate` (format: YYYY-MM-DD)
- Ensure all information matches the card **exactly**

#### Error: `SW = 0x6A82: FILE NOT FOUND`

**Cause:** This error occurred in older versions when trying to read DG11, which doesn't exist on Vietnam CCCD cards.

**Solution:** This is now handled automatically by the library. If you still see this error, make sure you're using the latest version from this repository.

### iOS Issues

If you encounter build issues on iOS:
1. Make sure Flipper is disabled in your Podfile
2. Ensure OpenSSL-Universal pod is installed
3. Run `pod install` in the ios directory
4. Clean build folder (Cmd+Shift+K) and rebuild

### Android Issues

If NFC reading doesn't start:
1. Verify NFC permissions are in AndroidManifest.xml
2. Check that NFC is enabled on the device
3. Ensure the device has NFC hardware capability

## What's Different in This Fork?

This fork adds specific support for Vietnam CCCD cards:

✅ **DG11 Optional**: The library no longer requires DG11 (which Vietnam CCCD cards don't have)
✅ **MRZ Fallback**: Automatically uses MRZ data when DG11 is unavailable
✅ **EF.SOD Support**: Reads and returns the Security Object Document for verification
✅ **Better Error Handling**: Wrapped DG2 and DG11 reads in try-catch blocks
✅ **iOS & Android**: Both platforms support SOD extraction

## Acknowledgments

This fork is maintained by [lylysunshinee](https://github.com/lylysunshinee) with Vietnam CCCD support modifications.

Original library by [Batuhan Öztürk](https://github.com/batuhanoztrk).

Special thanks to [Andy Qua](https://github.com/AndyQ) for his excellent [NFCPassportReader](https://github.com/AndyQ/NFCPassportReader) library that powers the iOS implementation of this package. His work on implementing BAC, Secure Messaging, and various passport data group readings has been instrumental in making this React Native wrapper possible.

## Contributing

See the [contributing guide](CONTRIBUTING.md) to learn how to contribute to the repository and the development workflow.

## License

MIT

---

Made with [create-react-native-library](https://github.com/callstack/react-native-builder-bob)
