# Hướng dẫn tích hợp NFC đọc thẻ CCCD Việt Nam

> Guide chi tiết để tích hợp chức năng đọc NFC thẻ CCCD Việt Nam vào React Native project

## 📋 Mục lục

1. [Tổng quan](#tổng-quan)
2. [Cài đặt dependencies](#cài-đặt-dependencies)
3. [Cấu hình Android](#cấu-hình-android)
4. [Sửa đổi library](#sửa-đổi-library)
5. [Tạo patch package](#tạo-patch-package)
6. [Implement UI](#implement-ui)
7. [Troubleshooting](#troubleshooting)

---

## Tổng quan

### Vấn đề gặp phải với thẻ CCCD Việt Nam

Library `react-native-nfc-passport-reader` được thiết kế cho passport quốc tế, nhưng thẻ CCCD Việt Nam có một số khác biệt:

- ❌ **Không có DG11**: Thẻ CCCD VN không chứa Data Group 11 (thông tin chi tiết)
- ✅ **Có DG1**: MRZ (Machine Readable Zone) - thông tin cơ bản
- ✅ **Có DG2**: Ảnh chân dung
- ✅ **Có EF.SOD**: Security Object Document (chữ ký số)

### Các thay đổi cần thiết

1. **Xử lý DG11 không tồn tại** (tránh lỗi `FILE NOT FOUND`)
2. **Sử dụng MRZ data làm fallback** khi không có DG11
3. **Đọc thêm EF.SOD** để verify chữ ký số
4. **Thêm field SOB** (Số định danh cá nhân)

---

## Cài đặt dependencies

### 1. Cài đặt library NFC

```bash
npm install react-native-nfc-passport-reader
# hoặc
yarn add react-native-nfc-passport-reader
```

### 2. Cài đặt patch-package (để lưu modifications)

```bash
npm install --save-dev patch-package
# hoặc
yarn add -D patch-package
```

### 3. Thêm postinstall script vào package.json

```json
{
  "scripts": {
    "postinstall": "patch-package"
  }
}
```

---

## Cấu hình Android

### AndroidManifest.xml

Thêm permissions và features:

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <!-- NFC Permissions -->
    <uses-permission android:name="android.permission.NFC" />
    <uses-feature android:name="android.hardware.nfc" android:required="false" />

    <application>
        <!-- Your activity config -->
    </application>
</manifest>
```

**Đường dẫn**: `android/app/src/main/AndroidManifest.xml`

---

## Sửa đổi library

### File 1: NfcResult.kt

**Đường dẫn**: `node_modules/react-native-nfc-passport-reader/android/src/main/java/com/nfcpassportreader/dto/NfcResult.kt`

**Thay đổi**:

```kotlin
package com.nfcpassportreader.dto

data class NfcResult(
  var birthDate: String? = null,
  var placeOfBirth: String? = null,
  var documentNo: String? = null,
  var expiryDate: String? = null,
  var firstName: String? = null,
  var gender: String? = null,
  var identityNo: String? = null,
  var lastName: String? = null,
  var mrz: String? = null,
  var nationality: String? = null,
  var originalFacePhoto: NfcImage? = null,
  var sod: String? = null, // ← THÊM DÒNG NÀY: EF.SOD as base64
)
```

### File 2: NfcPassportReader.kt

**Đường dẫn**: `node_modules/react-native-nfc-passport-reader/android/src/main/java/com/nfcpassportreader/NfcPassportReader.kt`

#### A. Thêm imports

```kotlin
package com.nfcpassportreader

import android.content.Context
import android.nfc.tech.IsoDep
import android.util.Base64  // ← THÊM
import com.nfcpassportreader.utils.*
import com.nfcpassportreader.dto.*
import net.sf.scuba.smartcards.CardService
import org.jmrtd.BACKeySpec
import org.jmrtd.PassportService
import org.jmrtd.lds.CardSecurityFile
import org.jmrtd.lds.PACEInfo
import org.jmrtd.lds.icao.DG11File
import org.jmrtd.lds.icao.DG1File
import org.jmrtd.lds.icao.DG2File
import org.jmrtd.lds.iso19794.FaceImageInfo
import java.io.ByteArrayOutputStream  // ← THÊM
```

#### B. Thay đổi trong function `readPassport()`

**TÌM đoạn code này** (sau dòng `val nfcResult = NfcResult()`):

```kotlin
val nfcResult = NfcResult()

val dg1In = service.getInputStream(PassportService.EF_DG1)
val dg1File = DG1File(dg1In)
val mrzInfo = dg1File.mrzInfo

val dg11In = service.getInputStream(PassportService.EF_DG11)
val dg11File = DG11File(dg11In)
```

**THAY BẰNG**:

```kotlin
val nfcResult = NfcResult()

// ========================================
// THÊM: Đọc EF.SOD (Security Object Document)
// ========================================
try {
  val sodInputStream = service.getInputStream(PassportService.EF_SOD)
  val sodBytes = ByteArrayOutputStream()
  val buffer = ByteArray(1024)
  var length: Int
  while (sodInputStream.read(buffer).also { length = it } != -1) {
    sodBytes.write(buffer, 0, length)
  }
  nfcResult.sod = Base64.encodeToString(sodBytes.toByteArray(), Base64.NO_WRAP)
} catch (e: Exception) {
  e.printStackTrace()
  // EF.SOD not available or failed to read
}

val dg1In = service.getInputStream(PassportService.EF_DG1)
val dg1File = DG1File(dg1In)
val mrzInfo = dg1File.mrzInfo

// ========================================
// SỬA: Wrap DG11 trong try-catch
// ========================================
try {
  val dg11In = service.getInputStream(PassportService.EF_DG11)
  val dg11File = DG11File(dg11In)

  if (!dg11File.nameOfHolder.isNullOrEmpty()) {
    val name = dg11File.nameOfHolder.substringAfterLast("<<").replace("<", " ")
    val surname = dg11File.nameOfHolder.substringBeforeLast("<<")
    nfcResult.firstName = name
    nfcResult.lastName = surname
  }

  if(!dg11File.placeOfBirth.isNullOrEmpty()){
    nfcResult.placeOfBirth = dg11File.placeOfBirth.joinToString(separator = " ")
  }

  if(!dg11File.fullDateOfBirth.isNullOrEmpty()){
    nfcResult.birthDate = dateUtil.convertFromMrzDate(dg11File.fullDateOfBirth)
  }
} catch (e: Exception) {
  // DG11 not available (common for Vietnam CCCD), use MRZ data instead
  e.printStackTrace()
}
```

#### C. Thêm fallback MRZ data

**TÌM đoạn code**:

```kotlin
mrzInfo.let {
  if(!it.dateOfExpiry.isNullOrEmpty()){
    nfcResult.expiryDate = dateUtil.convertFromMrzDate(it.dateOfExpiry)
  }

  nfcResult.identityNo = mrzInfo.personalNumber
  nfcResult.gender = mrzInfo.gender.toString()
  nfcResult.documentNo = it.documentNumber
  nfcResult.nationality = it.nationality
  nfcResult.mrz = it.toString()
}
```

**THAY BẰNG**:

```kotlin
mrzInfo.let {
  // ========================================
  // THÊM: Sử dụng MRZ data nếu DG11 không có
  // ========================================
  if (nfcResult.firstName.isNullOrEmpty() && nfcResult.lastName.isNullOrEmpty()) {
    nfcResult.firstName = it.secondaryIdentifier.replace("<", " ").trim()
    nfcResult.lastName = it.primaryIdentifier.replace("<", " ").trim()
  }

  if (nfcResult.birthDate.isNullOrEmpty() && !it.dateOfBirth.isNullOrEmpty()) {
    nfcResult.birthDate = dateUtil.convertFromMrzDate(it.dateOfBirth)
  }

  if(!it.dateOfExpiry.isNullOrEmpty()){
    nfcResult.expiryDate = dateUtil.convertFromMrzDate(it.dateOfExpiry)
  }

  nfcResult.identityNo = mrzInfo.personalNumber
  nfcResult.gender = mrzInfo.gender.toString()
  nfcResult.documentNo = it.documentNumber
  nfcResult.nationality = it.nationality
  nfcResult.mrz = it.toString()
}
```

#### D. Wrap DG2 (photo) trong try-catch

**TÌM đoạn code**:

```kotlin
if (includeImages) {
  val dg2In = service.getInputStream(PassportService.EF_DG2)
  val dg2File = DG2File(dg2In)
  val faceInfos = dg2File.faceInfos
  val allFaceImageInfos: MutableList<FaceImageInfo> = ArrayList()
  for (faceInfo in faceInfos) {
    allFaceImageInfos.addAll(faceInfo.faceImageInfos)
  }
  if (allFaceImageInfos.isNotEmpty()) {
    val faceImageInfo = allFaceImageInfos.iterator().next()
    val image = bitmapUtil.getImage(faceImageInfo)
    nfcResult.originalFacePhoto = image
  }
}
```

**THAY BẰNG**:

```kotlin
if (includeImages) {
  // ========================================
  // SỬA: Wrap DG2 trong try-catch
  // ========================================
  try {
    val dg2In = service.getInputStream(PassportService.EF_DG2)
    val dg2File = DG2File(dg2In)
    val faceInfos = dg2File.faceInfos
    val allFaceImageInfos: MutableList<FaceImageInfo> = ArrayList()
    for (faceInfo in faceInfos) {
      allFaceImageInfos.addAll(faceInfo.faceImageInfos)
    }
    if (allFaceImageInfos.isNotEmpty()) {
      val faceImageInfo = allFaceImageInfos.iterator().next()
      val image = bitmapUtil.getImage(faceImageInfo)
      nfcResult.originalFacePhoto = image
    }
  } catch (e: Exception) {
    // DG2 (photo) not available or failed to read
    e.printStackTrace()
  }
}
```

#### E. Xóa check DG11 bắt buộc

**TÌM và XÓA đoạn code này** (cuối function):

```kotlin
if (dg11File.length > 0) return nfcResult
else throw Exception("DG11 file is empty")
```

**THAY BẰNG**:

```kotlin
return nfcResult
```

### File 3: index.tsx (TypeScript types)

**Đường dẫn**: `node_modules/react-native-nfc-passport-reader/src/index.tsx`

**TÌM**:

```typescript
export type NfcResult = {
  birthDate: string;
  placeOfBirth?: string;
  documentNo: string;
  expiryDate: string;
  firstName: string;
  gender: string;
  identityNo?: string;
  lastName: string;
  mrz: string;
  nationality: string;
  originalFacePhoto?: string; // base64
};
```

**THAY BẰNG**:

```typescript
export type NfcResult = {
  birthDate: string;
  placeOfBirth?: string;
  documentNo: string;
  expiryDate: string;
  firstName: string;
  gender: string;
  identityNo?: string;
  lastName: string;
  mrz: string;
  nationality: string;
  originalFacePhoto?: string; // base64
  sod?: string; // ← THÊM: EF.SOD (Security Object Document) as base64
};
```

---

## Tạo patch package

Sau khi sửa xong tất cả các file trên, tạo patch:

```bash
npx patch-package react-native-nfc-passport-reader
```

Kết quả: File `patches/react-native-nfc-passport-reader+0.2.4.patch` được tạo ra.

**Commit patch vào git**:

```bash
git add patches/
git commit -m "Add patch for react-native-nfc-passport-reader to support Vietnam CCCD"
```

---

## Implement UI

### App.tsx - Component chính

```typescript
import * as React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import NfcPassportReader from 'react-native-nfc-passport-reader';
import type { NfcResult } from 'react-native-nfc-passport-reader';

const MyComponent = () => {
  const [supported, setSupported] = React.useState<boolean>(false);
  const [enabled, setEnabled] = React.useState<boolean>(false);
  const [isScanning, setIsScanning] = React.useState<boolean>(false);
  const [scanStatus, setScanStatus] = React.useState<string>('');
  const [result, setResult] = React.useState<NfcResult | null>(null);

  // Check NFC status
  React.useEffect(() => {
    const checkNfcStatus = async () => {
      try {
        const isSupported = await NfcPassportReader.isNfcSupported();
        const isEnabled = await NfcPassportReader.isNfcEnabled();
        setSupported(isSupported);
        setEnabled(isEnabled);
      } catch (error) {
        console.log('Error checking NFC status:', error);
      }
    };
    checkNfcStatus();
  }, []);

  // Listen for tag discovered
  React.useEffect(() => {
    NfcPassportReader.addOnTagDiscoveredListener(() => {
      console.log('Tag discovered!');
      setScanStatus('Đã phát hiện thẻ NFC! Đang đọc...');
    });

    return () => {
      NfcPassportReader.removeListeners();
    };
  }, []);

  // Start NFC reading
  const onResult = async () => {
    try {
      setIsScanning(true);
      setScanStatus('Sẵn sàng quét NFC. Vui lòng đưa thẻ CCCD gần điện thoại...');
      setResult(null);

      const nfcResult: NfcResult = await NfcPassportReader.startReading({
        bacKey: {
          documentNo: '093009672123', // 12 số CCCD (THAY ĐỔI)
          birthDate: '1993-11-01',     // Ngày sinh YYYY-MM-DD (THAY ĐỔI)
          expiryDate: '2033-11-01',    // Ngày hết hạn YYYY-MM-DD (THAY ĐỔI)
        },
        includeImages: true,
      });

      console.log('NFC Result:', nfcResult);
      setResult(nfcResult);
      setScanStatus('Đọc thành công!');
      setIsScanning(false);
    } catch (error) {
      console.log('NFC Error:', error);
      setScanStatus(`Lỗi: ${error}`);
      setIsScanning(false);
    }
  };

  const stopScanning = () => {
    NfcPassportReader.stopReading();
    setIsScanning(false);
    setScanStatus('');
  };

  return (
    <View style={styles.container}>
      {/* NFC Status */}
      <Text style={styles.txt}>NFC Supported: {supported ? 'Yes' : 'No'}</Text>
      <Text style={styles.txt}>NFC Enabled: {enabled ? 'Yes' : 'No'}</Text>

      {/* Scan Status */}
      {scanStatus !== '' && (
        <View style={styles.statusContainer}>
          <Text style={styles.statusText}>{scanStatus}</Text>
        </View>
      )}

      {/* Scanning Indicator */}
      {isScanning && (
        <View style={styles.scanningBox}>
          <Text style={styles.scanningText}>📱 Đưa thẻ CCCD vào mặt sau điện thoại</Text>
          <Text style={styles.scanningSubtext}>Giữ thẻ sát thiết bị cho đến khi đọc xong</Text>
        </View>
      )}

      {/* Result Display */}
      {result && (
        <View style={styles.resultContainer}>
          <Text style={styles.resultTitle}>Thông tin đã đọc:</Text>
          <Text style={styles.resultText}>Họ tên: {result.lastName} {result.firstName}</Text>
          <Text style={styles.resultText}>Ngày sinh: {result.birthDate}</Text>
          <Text style={styles.resultText}>Số CCCD: {result.documentNo}</Text>
          {result.identityNo && (
            <Text style={styles.resultText}>Số định danh (SOB): {result.identityNo}</Text>
          )}
          <Text style={styles.resultText}>
            Giới tính: {result.gender === 'M' ? 'Nam' : result.gender === 'F' ? 'Nữ' : result.gender}
          </Text>
          <Text style={styles.resultText}>Quốc tịch: {result.nationality}</Text>
          <Text style={styles.resultText}>Ngày hết hạn: {result.expiryDate}</Text>
          {result.placeOfBirth && (
            <Text style={styles.resultText}>Nơi sinh: {result.placeOfBirth}</Text>
          )}
          {result.sod && (
            <View style={styles.sodContainer}>
              <Text style={styles.sodTitle}>EF.SOD (Security Object):</Text>
              <Text style={styles.sodText} numberOfLines={3} ellipsizeMode="tail">
                {result.sod.substring(0, 100)}...
              </Text>
              <Text style={styles.sodInfo}>Độ dài: {result.sod.length} ký tự (base64)</Text>
            </View>
          )}
        </View>
      )}

      {/* Buttons */}
      <View style={styles.buttonContainer}>
        {!isScanning ? (
          <TouchableOpacity style={styles.button} onPress={onResult}>
            <Text style={styles.buttonText}>Bắt đầu quét NFC</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.button, styles.stopButton]} onPress={stopScanning}>
            <Text style={styles.buttonText}>Dừng quét</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2c3e50',
    padding: 20,
  },
  txt: {
    color: 'white',
    fontSize: 14,
    marginVertical: 5,
  },
  statusContainer: {
    marginTop: 20,
    padding: 15,
    backgroundColor: 'rgba(52, 152, 219, 0.3)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3498db',
  },
  statusText: {
    color: '#ecf0f1',
    fontSize: 14,
    textAlign: 'center',
  },
  scanningBox: {
    marginTop: 30,
    padding: 25,
    backgroundColor: 'rgba(46, 204, 113, 0.2)',
    borderRadius: 15,
    borderWidth: 2,
    borderColor: '#2ecc71',
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  scanningText: {
    color: '#2ecc71',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  scanningSubtext: {
    color: '#ecf0f1',
    fontSize: 14,
    textAlign: 'center',
  },
  resultContainer: {
    marginTop: 20,
    padding: 20,
    backgroundColor: 'rgba(46, 204, 113, 0.2)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2ecc71',
    width: '100%',
  },
  resultTitle: {
    color: '#2ecc71',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  resultText: {
    color: 'white',
    fontSize: 14,
    marginVertical: 3,
  },
  buttonContainer: {
    marginTop: 30,
    width: '100%',
  },
  button: {
    backgroundColor: '#3498db',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  stopButton: {
    backgroundColor: '#e74c3c',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  sodContainer: {
    marginTop: 15,
    padding: 12,
    backgroundColor: 'rgba(52, 152, 219, 0.2)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3498db',
  },
  sodTitle: {
    color: '#3498db',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  sodText: {
    color: '#ecf0f1',
    fontSize: 11,
    fontFamily: 'monospace',
    marginBottom: 5,
  },
  sodInfo: {
    color: '#95a5a6',
    fontSize: 12,
    fontStyle: 'italic',
  },
});

export default MyComponent;
```

### Lưu ý quan trọng về BAC Key

**Bạn PHẢI thay đổi 3 giá trị này** với thông tin CHÍNH XÁC từ thẻ CCCD:

```typescript
bacKey: {
  documentNo: '093009672123', // 12 số CCCD trên thẻ
  birthDate: '1993-11-01',    // Ngày sinh (YYYY-MM-DD)
  expiryDate: '2033-11-01',   // Ngày hết hạn (YYYY-MM-DD)
}
```

Nếu **sai 1 ký tự** sẽ báo lỗi: `SW = 0x6300: Mutual authentication failed`

---

## Troubleshooting

### Lỗi 1: `SW = 0x6300: Mutual authentication failed`

**Nguyên nhân**: Thông tin BAC Key không đúng

**Giải pháp**:
- Kiểm tra lại `documentNo` (phải đủ 12 số)
- Kiểm tra lại `birthDate` (format YYYY-MM-DD)
- Kiểm tra lại `expiryDate` (format YYYY-MM-DD)
- Đảm bảo thông tin khớp 100% với thẻ CCCD

### Lỗi 2: `SW = 0x6A82: FILE NOT FOUND`

**Nguyên nhân**: Thẻ CCCD Việt Nam không có DG11

**Giải pháp**: Đã được xử lý trong patch. Nếu vẫn gặp lỗi:
- Đảm bảo patch đã được apply: `npx patch-package`
- Rebuild app: `cd android && ./gradlew clean && cd .. && npx react-native run-android`

### Lỗi 3: Không có UI "Đưa thẻ vào điện thoại"

**Nguyên nhân**: Chưa implement state management

**Giải pháp**: Sử dụng code mẫu ở phần [Implement UI](#implement-ui)

### Lỗi 4: Patch không được apply sau npm install

**Nguyên nhân**: Thiếu postinstall script

**Giải pháp**:
```json
{
  "scripts": {
    "postinstall": "patch-package"
  }
}
```

### Lỗi 5: TypeScript type error cho `sod` field

**Nguyên nhân**: TypeScript cache

**Giải pháp**:
```bash
# Clean TypeScript cache
rm -rf node_modules/.cache
npx react-native start --reset-cache
```

---

## Áp dụng cho project mới

### Bước 1: Copy file patch

```bash
# Copy folder patches/ từ project cũ sang project mới
cp -r old-project/patches new-project/
```

### Bước 2: Cập nhật package.json

```json
{
  "scripts": {
    "postinstall": "patch-package"
  },
  "devDependencies": {
    "patch-package": "^8.0.1"
  },
  "dependencies": {
    "react-native-nfc-passport-reader": "^0.2.4"
  }
}
```

### Bước 3: Install và apply patch

```bash
npm install
# Patch sẽ tự động apply nhờ postinstall script
```

### Bước 4: Copy UI code

Copy toàn bộ component từ `App.tsx` trong guide này.

### Bước 5: Cấu hình Android

Copy phần NFC permissions vào `AndroidManifest.xml`.

### Bước 6: Build và test

```bash
npx react-native run-android
```

---

## Thông tin bổ sung

### Cấu trúc dữ liệu trả về

```typescript
interface NfcResult {
  birthDate: string;          // Ngày sinh
  placeOfBirth?: string;      // Nơi sinh (nếu có)
  documentNo: string;         // Số CCCD (12 số)
  expiryDate: string;         // Ngày hết hạn
  firstName: string;          // Tên
  gender: string;             // Giới tính (M/F)
  identityNo?: string;        // SOB (Số định danh)
  lastName: string;           // Họ
  mrz: string;                // MRZ string đầy đủ
  nationality: string;        // Quốc tịch (VNM)
  originalFacePhoto?: string; // Ảnh (base64)
  sod?: string;              // EF.SOD (base64)
}
```

### Data Groups trong thẻ CCCD Việt Nam

| Data Group | Tên | Có trong CCCD VN? | Mô tả |
|------------|-----|-------------------|-------|
| DG1 | MRZ | ✅ Có | Thông tin cơ bản (họ tên, số CCCD, ngày sinh, ngày hết hạn) |
| DG2 | Photo | ✅ Có | Ảnh chân dung |
| DG11 | Additional Details | ❌ Không | Thông tin bổ sung (nơi sinh, địa chỉ) |
| EF.SOD | Security Object | ✅ Có | Chữ ký số, hash của các DG |

### Về EF.SOD

EF.SOD chứa:
- Digital signature từ chính phủ
- Hash values của tất cả Data Groups
- Certificate chain để xác thực
- Có thể dùng để verify tính toàn vẹn của dữ liệu

---

## Checklist triển khai

- [ ] Cài đặt `react-native-nfc-passport-reader`
- [ ] Cài đặt `patch-package`
- [ ] Thêm postinstall script
- [ ] Copy patch file vào `patches/`
- [ ] Cấu hình AndroidManifest.xml
- [ ] Implement UI component
- [ ] Thay đổi BAC Key với thông tin thật
- [ ] Test với thẻ CCCD thật
- [ ] Verify dữ liệu trả về
- [ ] Commit patch vào git

---

## Tài liệu tham khảo

- [react-native-nfc-passport-reader](https://github.com/zubairabid/react-native-nfc-passport-reader)
- [ICAO Doc 9303](https://www.icao.int/publications/pages/publication.aspx?docnum=9303) - Machine Readable Travel Documents
- [patch-package](https://github.com/ds300/patch-package)

---

## License & Credits

Guide được tạo bởi Claude Code Assistant.

Các thay đổi trong patch được thiết kế để hỗ trợ đọc thẻ CCCD Việt Nam với library `react-native-nfc-passport-reader`.
