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

  React.useEffect(() => {
    // Listen for tag discovered event
    NfcPassportReader.addOnTagDiscoveredListener(() => {
      console.log('Tag discovered!');
      setScanStatus('Đã phát hiện thẻ NFC! Đang đọc...');
    });

    return () => {
      NfcPassportReader.removeListeners();
    };
  }, []);

  const onResult = async () => {
    try {
      setIsScanning(true);
      setScanStatus('Sẵn sàng quét NFC. Vui lòng đưa thẻ CCCD gần điện thoại...');
      setResult(null);

      const nfcResult: NfcResult = await NfcPassportReader.startReading({
        bacKey: {
          documentNo: '123456789', // ⚠️ THAY ĐỔI: 9 số CCCD trên thẻ (ví dụ: 012345678)
          birthDate: '1993-11-01',    // ⚠️ THAY ĐỔI: Ngày sinh ĐÚNG trên thẻ (YYYY-MM-DD)
          expiryDate: '2033-11-01',   // ⚠️ THAY ĐỔI: Ngày hết hạn ĐÚNG trên thẻ (YYYY-MM-DD)
        },
        includeImages: false,
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
          <Text style={styles.resultText}>Giới tính: {result.gender === 'M' ? 'Nam' : result.gender === 'F' ? 'Nữ' : result.gender}</Text>
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
