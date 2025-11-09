package com.nfcpassportreader

import android.content.Context
import android.nfc.tech.IsoDep
import android.util.Base64
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
import java.io.ByteArrayOutputStream

class NfcPassportReader(context: Context) {
  private val bitmapUtil = BitmapUtil(context)
  private val dateUtil = DateUtil()

  fun readPassport(isoDep: IsoDep, bacKey: BACKeySpec, includeImages: Boolean): NfcResult {
    isoDep.timeout = 10000

    val cardService = CardService.getInstance(isoDep)
    cardService.open()

    val service = PassportService(
      cardService,
      PassportService.NORMAL_MAX_TRANCEIVE_LENGTH,
      PassportService.DEFAULT_MAX_BLOCKSIZE,
      false,
      false
    )
    service.open()

    var paceSucceeded = false
    try {
      val cardSecurityFile =
        CardSecurityFile(service.getInputStream(PassportService.EF_CARD_SECURITY))
      val securityInfoCollection = cardSecurityFile.securityInfos

      for (securityInfo in securityInfoCollection) {
        if (securityInfo is PACEInfo) {
          service.doPACE(
            bacKey,
            securityInfo.objectIdentifier,
            PACEInfo.toParameterSpec(securityInfo.parameterId),
            null
          )
          paceSucceeded = true
        }
      }
    } catch (e: Exception) {
      e.printStackTrace()
    }

    service.sendSelectApplet(paceSucceeded)

    if (!paceSucceeded) {
      try {
        service.getInputStream(PassportService.EF_COM).read()
      } catch (e: Exception) {
        e.printStackTrace()

        service.doBAC(bacKey)
      }
    }

    val nfcResult = NfcResult()

    // Read EF.SOD (Security Object Document)
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

    // Wrap DG11 in try-catch for Vietnam CCCD compatibility
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

    mrzInfo.let {
      // Use MRZ data as fallback if DG11 is not available
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

    if (includeImages) {
      // Wrap DG2 in try-catch
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

    return nfcResult
  }
}
