import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Home, BookOpen, Calendar, Bell, PlayCircle, Mic, MicOff, ArrowLeft, 
  AlertCircle, Volume2, VolumeX, Award, Repeat, Keyboard, ChevronLeft, ChevronRight, 
  Settings, Check, Trash2, Save, Clock, Bookmark, Sliders, Eye, Globe, 
  BarChart2, TrendingUp, CheckCircle, XCircle, User, FileText, MessageSquare, 
  HelpCircle, Shield, CheckSquare, Sparkles, Send, RefreshCw, Sun, Camera
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fetchExams, fetchResults, postAssistanceRequest, updateStudentSubject } from '../services/api';
import { speakIn, cancelSpeech, formatSpokenName, getBuiltinVoices, speakBuiltinTTS, speakHover, resetHoverSpeech, isTTSActive, isVoiceDisabled, setVoiceDisabled } from './speech';
import { 
  speakWithElevenLabs, 
  cancelElevenLabsSpeech, 
  isElevenLabsPlaying, 
  getElevenLabsConfig, 
  saveElevenLabsConfig, 
  ELEVENLABS_VOICES 
} from '../services/elevenlabs';
import ElevenLabsSettings from './ElevenLabsSettings.jsx';
import ProjectLogo from './ProjectLogo.jsx';

export const formatDateForVoice = (rawDate) => {
  if (!rawDate) return '';
  const str = String(rawDate).trim();
  
  // Format YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss (e.g. 2026-10-09 -> 9 October 2026)
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const parts = str.split('T')[0].split('-');
    const year = parts[0];
    const monthIdx = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    if (monthIdx >= 0 && monthIdx < 12) {
      return `${day} ${months[monthIdx]} ${year}`;
    }
  }

  try {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const day = d.getDate();
      const monthName = d.toLocaleString('en-US', { month: 'long' });
      const year = d.getFullYear();
      return `${day} ${monthName} ${year}`;
    }
  } catch (e) {}

  return str;
};

// High-Precision Face Crop Extraction & Contrast-Normalized Biometric Feature Representation
export const extractBiometricFeaturesFromCanvas = (canvas, explicitBox = null) => {
  if (!canvas) return null;
  try {
    const W = canvas.width || 320;
    const H = canvas.height || 240;

    // Isolate Face Region (bounding box) to prevent room background / walls from corrupting face signature
    let bx = 0, by = 0, bw = W, bh = H;
    if (explicitBox && explicitBox.width > 20 && explicitBox.height > 20) {
      bx = Math.max(0, Math.floor(explicitBox.x || 0));
      by = Math.max(0, Math.floor(explicitBox.y || 0));
      bw = Math.min(W - bx, Math.floor(explicitBox.width));
      bh = Math.min(H - by, Math.floor(explicitBox.height));
    } else {
      // Focus on central face oval
      bx = Math.floor(W * 0.20);
      by = Math.floor(H * 0.12);
      bw = Math.floor(W * 0.60);
      bh = Math.floor(H * 0.76);
    }

    const faceAspect = bh / Math.max(1, bw);

    // Standardize face crop to normalized 48x48 pixel matrix
    const offCanvas = document.createElement('canvas');
    offCanvas.width = 48;
    offCanvas.height = 48;
    const offCtx = offCanvas.getContext('2d');
    if (!offCtx) return null;

    offCtx.drawImage(canvas, bx, by, bw, bh, 0, 0, 48, 48);
    const imgData = offCtx.getImageData(0, 0, 48, 48).data;

    // 1. Compute Raw Luminance and Chrominance
    const rawLum = new Float32Array(48 * 48);
    let totalCb = 0;
    let totalCr = 0;
    let pixelCount = 0;
    let minL = 1.0;
    let maxL = 0.0;

    for (let y = 0; y < 48; y++) {
      for (let x = 0; x < 48; x++) {
        const idx = (y * 48 + x) * 4;
        const r = imgData[idx];
        const g = imgData[idx + 1];
        const b = imgData[idx + 2];
        const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        rawLum[y * 48 + x] = lum;
        if (lum < minL) minL = lum;
        if (lum > maxL) maxL = lum;

        const cb = -0.168736 * r - 0.331264 * g + 0.5 * b + 128;
        const cr = 0.5 * r - 0.418688 * g - 0.081312 * b + 128;
        totalCb += cb;
        totalCr += cr;
        pixelCount++;
      }
    }

    const meanCb = pixelCount > 0 ? (totalCb / pixelCount) : 128;
    const meanCr = pixelCount > 0 ? (totalCr / pixelCount) : 128;

    // Contrast Normalization (Min-Max Histogram Expansion standardizes illumination between profile pic and live webcam)
    const lumMatrix = new Float32Array(48 * 48);
    const lumRange = Math.max(0.12, maxL - minL);
    for (let i = 0; i < 48 * 48; i++) {
      lumMatrix[i] = Math.min(1.0, Math.max(0.0, (rawLum[i] - minL) / lumRange));
    }

    // 6x6 Zones (8x8 pixels per zone) for spatial facial luminance pattern
    const grid = [];
    for (let zy = 0; zy < 6; zy++) {
      for (let zx = 0; zx < 6; zx++) {
        let zoneSum = 0;
        for (let y = zy * 8; y < (zy + 1) * 8; y++) {
          for (let x = zx * 8; x < (zx + 1) * 8; x++) {
            zoneSum += lumMatrix[y * 48 + x];
          }
        }
        grid.push(zoneSum / 64);
      }
    }

    // 2. High-Precision Eye Band Edge Gradient (on contrast-normalized luminance)
    // Eye band is located in normalized rows 12 through 24
    let eyeEdgeSum = 0;
    let eyePixelCount = 0;
    for (let y = 12; y < 24; y++) {
      for (let x = 4; x < 44; x++) {
        const gx = Math.abs(lumMatrix[y * 48 + (x + 1)] - lumMatrix[y * 48 + (x - 1)]);
        const gy = Math.abs(lumMatrix[(y + 1) * 48 + x] - lumMatrix[(y - 1) * 48 + x]);
        const grad = Math.sqrt(gx * gx + gy * gy);
        if (grad > 0.18) {
          eyeEdgeSum += 1;
        }
        eyePixelCount++;
      }
    }
    const eyeEdgeEnergy = eyePixelCount > 0 ? (eyeEdgeSum / eyePixelCount) : 0;

    // 3. Mouth & Jaw Band Edge Gradient
    let mouthEdgeSum = 0;
    let mouthPixelCount = 0;
    for (let y = 30; y < 42; y++) {
      for (let x = 8; x < 40; x++) {
        const gx = Math.abs(lumMatrix[y * 48 + (x + 1)] - lumMatrix[y * 48 + (x - 1)]);
        const gy = Math.abs(lumMatrix[(y + 1) * 48 + x] - lumMatrix[(y - 1) * 48 + x]);
        if (Math.sqrt(gx * gx + gy * gy) > 0.18) {
          mouthEdgeSum += 1;
        }
        mouthPixelCount++;
      }
    }
    const mouthEdgeEnergy = mouthPixelCount > 0 ? (mouthEdgeSum / mouthPixelCount) : 0;

    // 4. Horizontal Yaw / Profile Balance (Columns 0, 1 vs Columns 4, 5)
    let leftHalfLum = 0;
    let rightHalfLum = 0;
    for (let zy = 0; zy < 6; zy++) {
      for (let zx = 0; zx < 2; zx++) leftHalfLum += grid[zy * 6 + zx];
      for (let zx = 4; zx < 6; zx++) rightHalfLum += grid[zy * 6 + zx];
    }
    const yawBalance = (leftHalfLum - rightHalfLum) / Math.max(0.01, leftHalfLum + rightHalfLum);

    return {
      grid,
      eyeEdgeEnergy,
      mouthEdgeEnergy,
      faceAspect,
      meanCb,
      meanCr,
      yawBalance,
      isFaceCrop: true
    };
  } catch (e) {
    return null;
  }
};

// Biometric Feature Extraction from Registered Profile Picture
export const extractBiometricFeaturesFromImage = (imgSrc) => {
  return new Promise((resolve) => {
    if (!imgSrc) {
      resolve(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = img.naturalWidth || img.width || 320;
        tempCanvas.height = img.naturalHeight || img.height || 240;
        const ctx = tempCanvas.getContext('2d');
        if (!ctx) { resolve(null); return; }
        ctx.drawImage(img, 0, 0, tempCanvas.width, tempCanvas.height);

        const feat = extractBiometricFeaturesFromCanvas(tempCanvas, null);
        resolve(feat);
      } catch (err) {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = imgSrc;
  });
};

// High-Discriminative Mean-Centered Pearson Biometric Correlation & Pattern Matching
export const computeBiometricSimilarity = (biomA, biomB) => {
  if (!biomA || !biomB) return 0;
  const gA = Array.isArray(biomA) ? biomA : biomA.grid;
  const gB = Array.isArray(biomB) ? biomB : biomB.grid;
  if (!gA || !gB || gA.length !== gB.length) return 0;

  // Mean-Centered Pearson Correlation Coefficient (r)
  const mA = gA.reduce((s, v) => s + v, 0) / gA.length;
  const mB = gB.reduce((s, v) => s + v, 0) / gB.length;
  let num = 0, dA = 0, dB = 0;
  for (let i = 0; i < gA.length; i++) {
    const diffA = gA[i] - mA;
    const diffB = gB[i] - mB;
    num += diffA * diffB;
    dA += diffA * diffA;
    dB += diffB * diffB;
  }
  let pearson = (dA > 0 && dB > 0) ? (num / Math.sqrt(dA * dB)) : 0;
  if (pearson <= 0) return 0;

  // If rich biometric objects are provided, evaluate structural facial distinctions
  if (!Array.isArray(biomA) && !Array.isArray(biomB)) {
    // Eyewear / Glasses / Eye Band Difference Penalty (tolerant to room shadow variations)
    const eyeDiff = Math.abs((biomA.eyeEdgeEnergy || 0) - (biomB.eyeEdgeEnergy || 0));
    const eyePenalty = eyeDiff > 0.30 ? Math.min(0.08, (eyeDiff - 0.30) * 0.5) : 0;

    // Face Aspect Ratio Difference Penalty (tolerant to looking slightly up/down while reading/writing)
    const aspectDiff = Math.abs((biomA.faceAspect || 1.25) - (biomB.faceAspect || 1.25));
    const aspectPenalty = aspectDiff > 0.40 ? Math.min(0.06, (aspectDiff - 0.40) * 0.5) : 0;

    // Skin Chrominance Distance Penalty (YCbCr space)
    // Webcams continuously auto-adjust white balance/exposure; allow up to 45 units difference
    const chromaDist = Math.hypot((biomA.meanCb || 120) - (biomB.meanCb || 120), (biomA.meanCr || 145) - (biomB.meanCr || 145));
    const chromaPenalty = chromaDist > 45 ? Math.min(0.08, (chromaDist - 45) / 100) : 0;

    pearson = Math.max(0, pearson - eyePenalty - aspectPenalty - chromaPenalty);
  }

  return Math.min(1.0, Math.max(0, pearson));
};

// Accurately counts how many distinct questions in an exam have a valid non-empty answer (guarantees count <= total questions)
export const getExamQuestionsAnsweredCount = (exam, answers, currentInput, curQIdx) => {
  if (!exam || !Array.isArray(exam.questions) || exam.questions.length === 0) return 0;
  const examId = exam.id || exam._id || '';
  const ansMap = answers || {};
  const answeredCount = exam.questions.filter((q, idx) => {
    const qId = q && q.id !== undefined ? q.id : idx + 1;
    const live = (idx === curQIdx && currentInput) ? String(currentInput).trim() : '';
    const saved = (
      ansMap[`${examId}-${idx}`] ||
      ansMap[`${exam.id}-${idx}`] ||
      ansMap[`${exam._id}-${idx}`] ||
      ansMap[idx] ||
      ansMap[`q_${idx}`] ||
      ansMap[`${qId}`] ||
      ansMap[`q_${qId}`] ||
      ''
    );
    return Boolean(live || String(saved).trim());
  }).length;
  return Math.min(answeredCount, exam.questions.length);
};

// High-Precision Multi-Person & Face Detection from Camera Canvas (Single vs Multiple People)
export const detectPeopleInCanvas = async (canvas) => {
  if (!canvas) return { count: 0, isMultiple: false, isPresent: false, primaryFaceBox: null };
  
  const W = canvas.width || 320;
  const H = canvas.height || 240;

  let nativeRan = false;
  let nativeFoundZero = false;

  // 1. Check Native Browser FaceDetector (Chromium Shape Detection API)
  if (typeof window !== 'undefined' && 'FaceDetector' in window) {
    try {
      const faceDetector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 10 });
      const detectedFaces = await faceDetector.detect(canvas);
      nativeRan = true;
      if (Array.isArray(detectedFaces)) {
        if (detectedFaces.length === 0) {
          nativeFoundZero = true;
        }
        // Discard tiny false-positive boxes / noise (each real face must be >= 18% frame width and height)
        const minW = W * 0.18;
        const minH = H * 0.18;
        const validFaces = detectedFaces.filter(f => {
          const b = f.boundingBox || {};
          return (b.width >= minW && b.height >= minH);
        });

        if (validFaces.length === 0) {
          nativeFoundZero = true;
        }

        if (validFaces.length > 0) {
          // If multiple faces are reported, ensure they are distinct and horizontally separated
          if (validFaces.length > 1) {
            const sorted = [...validFaces].sort((a, b) => (b.boundingBox.width * b.boundingBox.height) - (a.boundingBox.width * a.boundingBox.height));
            const primary = sorted[0].boundingBox;
            const primaryCenterX = primary.x + primary.width / 2;

            let genuineOtherFaces = 0;
            for (let i = 1; i < sorted.length; i++) {
              const sec = sorted[i].boundingBox;
              const secCenterX = sec.x + sec.width / 2;
              // Distinct separate person requires horizontal separation of >= 28% of frame width
              if (Math.abs(primaryCenterX - secCenterX) >= W * 0.28) {
                genuineOtherFaces++;
              }
            }

            if (genuineOtherFaces > 0) {
              return {
                count: 1 + genuineOtherFaces,
                isMultiple: true,
                isPresent: true,
                method: 'native-face-detector',
                faces: validFaces,
                primaryFaceBox: sorted[0]?.boundingBox
              };
            }
          }

          return {
            count: 1,
            isMultiple: false,
            isPresent: true,
            method: 'native-face-detector',
            faces: [validFaces[0]],
            primaryFaceBox: validFaces[0]?.boundingBox
          };
        }
      }
    } catch (e) {}
  }

  // 2. High-Precision Computer Vision (Adaptive Lighting + YCbCr Skin Segmentation + Head Geometry Analysis)
  try {
    const ctx = canvas.getContext('2d');
    if (!ctx) return { count: 0, isMultiple: false, isPresent: false, primaryFaceBox: null };

    const imgData = ctx.getImageData(0, 0, W, H).data;
    const cols = 32;
    const rows = 24;
    const cellW = Math.max(1, Math.floor(W / cols));
    const cellH = Math.max(1, Math.floor(H / rows));
    const skinGrid = new Uint8Array(cols * rows);

    // Step A: Calculate luminance across central/upper region to detect backlight/underexposure
    let centerLumSum = 0;
    let centerSampleCount = 0;
    const startCenterY = Math.floor(H * 0.15);
    const endCenterY = Math.floor(H * 0.75);
    const startCenterX = Math.floor(W * 0.25);
    const endCenterX = Math.floor(W * 0.75);

    for (let py = startCenterY; py < endCenterY; py += 6) {
      for (let px = startCenterX; px < endCenterX; px += 6) {
        const idx = (py * W + px) * 4;
        const lum = 0.299 * imgData[idx] + 0.587 * imgData[idx + 1] + 0.114 * imgData[idx + 2];
        centerLumSum += lum;
        centerSampleCount++;
      }
    }
    const avgCenterLum = centerSampleCount > 0 ? (centerLumSum / centerSampleCount) : 100;
    // Auto exposure compensation gain for dark/backlit faces
    const autoGain = (avgCenterLum < 85) ? Math.min(2.2, 120 / Math.max(25, avgCenterLum)) : 1.0;

    let totalSkinPixels = 0;
    let totalSampled = 0;
    let ovalSkinPixels = 0;
    let ovalTotalPixels = 0;

    const ovalCX = W * 0.5;
    const ovalCY = H * 0.5;
    const ovalRX = W * 0.26;
    const ovalRY = H * 0.38;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        let cellSkin = 0;
        let cellCount = 0;
        const startY = r * cellH;
        const endY = Math.min(H, (r + 1) * cellH);
        const startX = c * cellW;
        const endX = Math.min(W, (c + 1) * cellW);

        for (let py = startY; py < endY; py += 3) {
          for (let px = startX; px < endX; px += 3) {
            const idx = (py * W + px) * 4;
            let red = imgData[idx];
            let green = imgData[idx + 1];
            let blue = imgData[idx + 2];

            // Apply software auto-gain if underexposed/backlit
            if (autoGain > 1.0) {
              red = Math.min(255, red * autoGain);
              green = Math.min(255, green * autoGain);
              blue = Math.min(255, blue * autoGain);
            }

            cellCount++;
            totalSampled++;

            const dx = (px - ovalCX) / ovalRX;
            const dy = (py - ovalCY) / ovalRY;
            const inOval = (dx * dx + dy * dy) <= 1.0;
            if (inOval) ovalTotalPixels++;

            // Inclusive multi-ethnic human skin chroma model (YCbCr + normalized RGB)
            const cb = -0.168736 * red - 0.331264 * green + 0.5 * blue + 128;
            const cr = 0.5 * red - 0.418688 * green - 0.081312 * blue + 128;
            
            const isYCbCrSkin = (cb >= 75 && cb <= 138 && cr >= 126 && cr <= 182);
            const isRgbSkin = (
              red > 30 && green > 18 && blue > 14 &&
              red >= green && (red - blue) >= 3
            );
            const sumRgb = red + green + blue;
            const normR = sumRgb > 0 ? (red / sumRgb) : 0;
            const normG = sumRgb > 0 ? (green / sumRgb) : 0;
            const isNormRgbSkin = (normR >= 0.33 && normR <= 0.62 && normG >= 0.23 && normG <= 0.41);

            const isSkin = isYCbCrSkin && (isRgbSkin || isNormRgbSkin);

            if (isSkin) {
              cellSkin++;
              totalSkinPixels++;
              if (inOval) ovalSkinPixels++;
            }
          }
        }

        // Cell is marked as skin if >= 20% of sampled pixels match human skin
        if (cellCount > 0 && (cellSkin / cellCount) >= 0.20) {
          skinGrid[r * cols + c] = 1;
        }
      }
    }

    const overallSkinRatio = totalSampled > 0 ? (totalSkinPixels / totalSampled) : 0;
    const ovalSkinRatio = ovalTotalPixels > 0 ? (ovalSkinPixels / ovalTotalPixels) : 0;

    // Check if the central oval has candidate face presence (substantial skin concentration)
    const isOvalFacePresent = (ovalSkinRatio >= 0.22);

    // Connected Component Analysis on Upper Screen (Head Search Region)
    const searchMaxRow = Math.floor(rows * 0.70);
    const visited = new Uint8Array(cols * rows);
    const headCandidates = [];

    for (let r = 0; r < searchMaxRow; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        if (skinGrid[idx] === 1 && !visited[idx]) {
          const queue = [[c, r]];
          visited[idx] = 1;
          let minC = c, maxC = c, minR = r, maxR = r;
          let sumC = 0, sumR = 0;
          let count = 0;

          while (queue.length > 0) {
            const [curC, curR] = queue.shift();
            count++;
            sumC += curC;
            sumR += curR;
            if (curC < minC) minC = curC;
            if (curC > maxC) maxC = curC;
            if (curR < minR) minR = curR;
            if (curR > maxR) maxR = curR;

            const neighbors = [
              [curC + 1, curR], [curC - 1, curR],
              [curC, curR + 1], [curC, curR - 1]
            ];
            for (const [nc, nr] of neighbors) {
              if (nc >= 0 && nc < cols && nr >= 0 && nr < searchMaxRow) {
                const nIdx = nr * cols + nc;
                if (skinGrid[nIdx] === 1 && !visited[nIdx]) {
                  visited[nIdx] = 1;
                  queue.push([nc, nr]);
                }
              }
            }
          }

          const widthCells = maxC - minC + 1;
          const heightCells = maxR - minR + 1;
          const aspect = heightCells / Math.max(1, widthCells);
          const centerC = sumC / count;
          const centerR = sumR / count;

          // A valid human head/face has substantial mass (>= 24 cells), oval aspect ratio, width >= 4 cells, height >= 4 cells,
          // and is positioned in the camera view (not stuck on extreme perimeter borders like column <= 2 or >= 29)
          if (count >= 24 && widthCells >= 4 && heightCells >= 4 && aspect >= 0.65 && aspect <= 2.5 && centerC >= 4 && centerC <= 27) {
            headCandidates.push({
              count,
              centerCol: centerC,
              centerRow: centerR,
              widthCells,
              heightCells,
              minC, maxC, minR, maxR
            });
          }
        }
      }
    }

    headCandidates.sort((a, b) => b.count - a.count);

    // If native FaceDetector was active and explicitly found 0 faces:
    // Only accept fallback if a very strong central head mass is detected (low-light recovery).
    if (nativeRan && nativeFoundZero) {
      if (headCandidates.length === 0 || headCandidates[0].count < 38 || ovalSkinRatio < 0.16) {
        return {
          count: 0,
          isMultiple: false,
          isPresent: false,
          primaryFaceBox: null,
          lightingQuality: avgCenterLum < 65 ? 'low' : avgCenterLum > 210 ? 'overexposed' : 'good',
          avgLuminance: Math.round(avgCenterLum)
        };
      }
    }

    // If no distinct connected component was formed:
    if (headCandidates.length === 0) {
      if (isOvalFacePresent && !nativeFoundZero) {
        return {
          count: 1,
          isMultiple: false,
          isPresent: true,
          method: 'oval-skin-inspection',
          lightingQuality: avgCenterLum < 65 ? 'low' : avgCenterLum > 210 ? 'overexposed' : 'good',
          avgLuminance: Math.round(avgCenterLum),
          primaryFaceBox: {
            x: Math.floor(W * 0.20),
            y: Math.floor(H * 0.12),
            width: Math.floor(W * 0.60),
            height: Math.floor(H * 0.76)
          }
        };
      }
      return {
        count: 0,
        isMultiple: false,
        isPresent: false,
        primaryFaceBox: null,
        lightingQuality: 'none',
        avgLuminance: Math.round(avgCenterLum)
      };
    }

    const primaryHead = headCandidates[0];

    // Check if primary head has sufficient mass to be a real human head in webcam
    if (primaryHead.count < 28 && ovalSkinRatio < 0.20) {
      return {
        count: 0,
        isMultiple: false,
        isPresent: false,
        primaryFaceBox: null,
        lightingQuality: 'none',
        avgLuminance: Math.round(avgCenterLum)
      };
    }
    let multiplePeople = false;
    let genuineSecondHeadCount = 0;

    // Check if there is a distinct genuine SECOND human head in frame
    for (let i = 1; i < headCandidates.length; i++) {
      const secondaryHead = headCandidates[i];
      // Exclude extreme perimeter border artifacts (wardrobe/cupboard edges, deity stickers, wall corners at column <= 2 or >= 29)
      const isExtremeBorder = (secondaryHead.minC <= 2 || secondaryHead.maxC >= 29);
      if (isExtremeBorder) continue;

      // A genuine second person's head must:
      // 1. Have substantial mass: at least 48 cells and at least 65% the mass of primary head
      // 2. Be comfortably inside the camera view (centerCol between 4 and 27)
      // 3. Be at human sitting/standing eye level (vDist <= 6 rows from primary head)
      // 4. Be horizontally separated (hDist >= 11 columns out of 32)
      // 5. Have genuine head dimensions: width >= 6 cells, height >= 6 cells, aspect between 0.8 and 2.0
      // 6. NOT be vertically directly below primary head (e.g. neck or collar)
      const hDist = Math.abs(primaryHead.centerCol - secondaryHead.centerCol);
      const isBelowPrimary = (hDist < 6 && secondaryHead.centerRow > primaryHead.centerRow);
      const vDist = Math.abs(primaryHead.centerRow - secondaryHead.centerRow);
      
      if (
        !isBelowPrimary &&
        secondaryHead.count >= 48 &&
        secondaryHead.count >= primaryHead.count * 0.65 &&
        secondaryHead.centerCol >= 4 && secondaryHead.centerCol <= 27 &&
        secondaryHead.centerRow <= (rows * 0.55) &&
        vDist <= 6 &&
        hDist >= 11 &&
        secondaryHead.widthCells >= 6 &&
        secondaryHead.heightCells >= 6
      ) {
        multiplePeople = true;
        genuineSecondHeadCount++;
        break;
      }
    }

    return {
      count: multiplePeople ? (1 + genuineSecondHeadCount) : 1,
      isMultiple: multiplePeople,
      isPresent: true,
      method: 'geometry-skin-analysis',
      lightingQuality: avgCenterLum < 65 ? 'low' : avgCenterLum > 210 ? 'overexposed' : 'good',
      avgLuminance: Math.round(avgCenterLum),
      primaryFaceBox: primaryHead ? {
        x: Math.max(0, primaryHead.minC * cellW),
        y: Math.max(0, primaryHead.minR * cellH),
        width: Math.min(W, (primaryHead.maxC - primaryHead.minC + 1) * cellW),
        height: Math.min(H, (primaryHead.maxR - primaryHead.minR + 1) * cellH)
      } : {
        x: Math.floor(W * 0.20),
        y: Math.floor(H * 0.12),
        width: Math.floor(W * 0.60),
        height: Math.floor(H * 0.76)
      }
    };
  } catch (err) {
    return { count: 0, isMultiple: false, isPresent: false, primaryFaceBox: null };
  }
};

const readStudentProfile = () => {
  try {
    const session = JSON.parse(localStorage.getItem('auth_session') || '{}');
    const regUser = JSON.parse(localStorage.getItem('registered_user') || '{}');
    const userEmail = (session.email || regUser.email || '').trim().toLowerCase();
    
    // Profiles partitioned strictly per user email
    const allProfiles = JSON.parse(localStorage.getItem('student_profiles_by_email') || '{}');
    const userProfile = userEmail ? (allProfiles[userEmail] || {}) : {};

    // Clean up deleted fields from student profile cache
    delete userProfile.collegeName;
    delete userProfile.universityName;
    delete userProfile.fatherName;
    delete userProfile.fatherPhone;
    delete userProfile.motherName;
    delete userProfile.motherPhone;
    delete userProfile.phone;
    delete userProfile.course;
    if (userProfile.registerNumber && !String(userProfile.registerNumber).startsWith('202601100')) {
      delete userProfile.registerNumber;
    }
    if (userProfile.studentId && !String(userProfile.studentId).startsWith('202601100')) {
      delete userProfile.studentId;
    }

    const rawStoredName = userProfile.name || session.name || session.fullName || regUser.name || regUser.fullName || localStorage.getItem('user_name') || userProfile.username || session.username || regUser.username || (userEmail ? userEmail.split('@')[0] : '') || 'Student';
    const cleanName = formatSpokenName(rawStoredName);

    // Keep stored profile name and session name synced with clean human name
    if (userEmail && cleanName && cleanName !== 'Student') {
      if (userProfile.name !== cleanName) {
        userProfile.name = cleanName;
        allProfiles[userEmail] = userProfile;
        try {
          localStorage.setItem('student_profiles_by_email', JSON.stringify(allProfiles));
        } catch (e) {}
      }
      if (session.name !== cleanName) {
        session.name = cleanName;
        try {
          localStorage.setItem('auth_session', JSON.stringify(session));
        } catch (e) {}
      }
    }

    const email = userEmail || userProfile.email || session.email || 'student@school.edu';
    
    // Resolve register number strictly with 9-digit base prefix 202601100 followed by sequential index (2026011001, 2026011002...)
    let regNo = userProfile.registerNumber || userProfile.studentId || session.registerNumber || session.studentId || regUser.studentId || '';
    if (regNo && !String(regNo).startsWith('202601100')) {
      regNo = '';
    }

    if (!regNo && userEmail) {
      try {
        const regMap = JSON.parse(localStorage.getItem('student_reg_number_map') || '{}');
        if (regMap[userEmail] && String(regMap[userEmail]).startsWith('202601100')) {
          regNo = regMap[userEmail];
        } else {
          const existingSeqs = Object.values(regMap)
            .map(val => parseInt(String(val).replace('202601100', ''), 10))
            .filter(n => !isNaN(n));
          const nextSeq = existingSeqs.length > 0 ? Math.max(...existingSeqs) + 1 : 1;
          regNo = `202601100${nextSeq}`;
          regMap[userEmail] = regNo;
          localStorage.setItem('student_reg_number_map', JSON.stringify(regMap));
        }
      } catch (e) {
        regNo = '2026011001';
      }
    }
    if (!regNo) regNo = '2026011001';

    // Persist assigned sequential register number to student profile partition if missing
    if (userEmail && (!userProfile.registerNumber || userProfile.registerNumber !== regNo)) {
      userProfile.registerNumber = regNo;
      userProfile.studentId = regNo;
      allProfiles[userEmail] = userProfile;
      try {
        localStorage.setItem('student_profiles_by_email', JSON.stringify(allProfiles));
      } catch (e) {}
    }

    const sharedSubjects = JSON.parse(localStorage.getItem('shared_student_subjects') || '{}');
    const assignedSub = (userEmail && sharedSubjects[userEmail]) || userProfile.interestedSubject || session.interestedSubject || userProfile.subject || session.subject || 'Computer Science';

    // Exhaustive multi-source profile photo resolution
    const resolvedPhoto = 
      userProfile.profilePic || 
      session.profilePic || 
      localStorage.getItem('student_profile_pic') || 
      localStorage.getItem('last_active_student_profile_pic') ||
      (allProfiles[userEmail]?.profilePic) ||
      (allProfiles['default']?.profilePic) ||
      (Object.values(allProfiles).find(p => p && p.profilePic)?.profilePic) ||
      null;

    if (resolvedPhoto) {
      userProfile.profilePic = resolvedPhoto;
      try {
        localStorage.setItem('student_profile_pic', resolvedPhoto);
        localStorage.setItem('last_active_student_profile_pic', resolvedPhoto);
        if (userEmail) {
          allProfiles[userEmail] = { ...(allProfiles[userEmail] || {}), ...userProfile, profilePic: resolvedPhoto };
          localStorage.setItem('student_profiles_by_email', JSON.stringify(allProfiles));
        }
      } catch (e) {}
    }

    return { 
      name: cleanName || 'Nayana N S', 
      email, 
      studentId: regNo,
      registerNumber: regNo,
      phone: userProfile.phone || session.phone || regUser.phone || '',
      collegeName: userProfile.collegeName || session.collegeName || '',
      universityName: userProfile.universityName || session.universityName || '',
      fatherName: userProfile.fatherName || session.fatherName || '',
      fatherPhone: userProfile.fatherPhone || session.fatherPhone || '',
      motherName: userProfile.motherName || session.motherName || '',
      motherPhone: userProfile.motherPhone || session.motherPhone || '',
      subject: assignedSub,
      interestedSubject: assignedSub,
      profilePic: resolvedPhoto
    };
  } catch (err) {
    return { 
      name: 'Nayana N S', 
      email: 'student@school.edu', 
      studentId: '2026011001',
      registerNumber: '2026011001',
      phone: '',
      collegeName: '',
      universityName: '',
      fatherName: '',
      fatherPhone: '',
      motherName: '',
      motherPhone: '',
      subject: 'Computer Science',
      interestedSubject: 'Computer Science',
      profilePic: localStorage.getItem('student_profile_pic') || localStorage.getItem('last_active_student_profile_pic') || null
    };
  }
};

const COURSE_CATEGORIES = [
  {
    category: '🎒 School Education (Classes 1 - 12)',
    options: [
      'Primary School (Class 1 - 5)',
      'Middle School (Class 6 - 8)',
      'High School / SSLC (Class 9 - 10)',
      'Higher Secondary 11th Standard (Class 11 / Inter 1st Year)',
      'Higher Secondary 12th Standard (Class 12 / HSC / Inter 2nd Year / PUC)'
    ]
  },
  {
    category: '🛠️ Diploma & Vocational Qualification',
    options: [
      'Polytechnic Diploma in Engineering & Technology',
      'Diploma in Computer Applications (DCA / IT)',
      'Diploma in Allied Health / Paramedical Sciences',
      'Industrial Training Institute (ITI) / Vocational Certificate'
    ]
  },
  {
    category: '🎓 Undergraduate Degrees (UG)',
    options: [
      'B.Sc Computer Science / Information Technology / AI',
      'B.Sc Science (Physics / Chemistry / Mathematics / Biology)',
      'B.Tech / B.E. Engineering',
      'B.C.A. (Bachelor of Computer Applications)',
      'B.Com (Bachelor of Commerce)',
      'B.B.A / B.M.S (Management Studies)',
      'B.A. (Bachelor of Arts)',
      'B.Ed (Bachelor of Education)',
      'M.B.B.S / B.D.S / Medical Sciences',
      'LL.B (Bachelor of Laws)',
      'Other Undergraduate (UG) Degree'
    ]
  },
  {
    category: '📜 Postgraduate Degrees (PG)',
    options: [
      'M.Sc Computer Science / Data Science / AI',
      'M.Tech / M.E. Engineering',
      'M.C.A. (Master of Computer Applications)',
      'M.Com (Master of Commerce)',
      'M.B.A. (Master of Business Administration)',
      'M.A. (Master of Arts)',
      'M.Ed / M.Phil',
      'Other Postgraduate (PG) Degree'
    ]
  },
  {
    category: '🔬 Research, Competitive & Special Education',
    options: [
      'Ph.D. / Doctoral Research Scholar',
      'Competitive Exam Preparation (UPSC / GATE / Banking / NET / SSC)',
      'Skill Certification / Short-term Professional Program',
      'Special Education Student'
    ]
  }
];

export const MAIN_SUBJECTS = [
  "Computer Science",
  "Mathematics",
  "Physics",
  "Chemistry",
  "Biology",
  "Commerce",
  "Social Science",
  "Engineering"
];

export const MAIN_SUBJECT_SUB_MAP = {
  "Computer Science": [
    "computer science", "computer", "computers", "cs", "it", "information technology",
    "software engineering", "software", "programming", "coding", "code",
    "data structures", "algorithms", "dsa", "data structures & algorithms",
    "database management systems", "database", "dbms", "sql", "rdbms",
    "operating systems", "os", "linux", "unix",
    "computer networks", "networking", "cn", "internet",
    "artificial intelligence", "ai", "machine learning", "ml", "deep learning", "ai & ml",
    "data science", "data science & analytics", "data analytics", "big data",
    "cybersecurity", "cyber security", "cryptography", "network security",
    "web technologies", "web development", "web design", "frontend", "backend", "fullstack",
    "mobile application development", "android", "ios", "app development",
    "cloud computing", "cloud", "devops", "aws", "azure",
    "internet of things", "iot",
    "python programming", "python",
    "java programming", "java",
    "c / c++ programming", "c++", "c programming", "c#",
    "web accessibility", "assistive technology", "assistive tech"
  ],
  "Mathematics": [
    "mathematics", "math", "maths", "applied mathematics", "pure mathematics",
    "algebra", "linear algebra", "calculus", "differential equations", "integration",
    "geometry", "trigonometry", "statistics", "probability", "statistics & probability",
    "discrete mathematics", "arithmetic", "numerical analysis", "matrices"
  ],
  "Physics": [
    "physics", "applied physics", "mechanics", "thermodynamics", "optics",
    "electromagnetism", "quantum physics", "modern physics", "astrophysics",
    "space science", "astrophysics & space science", "nuclear physics", "atomic physics",
    "waves and acoustics", "general science", "science"
  ],
  "Chemistry": [
    "chemistry", "organic chemistry", "inorganic chemistry", "physical chemistry",
    "biochemistry", "analytical chemistry", "chemical bonding", "electrochemistry",
    "polymers", "environmental chemistry"
  ],
  "Biology": [
    "biology", "life sciences", "biology / life sciences", "botany", "zoology",
    "genetics", "biotechnology", "microbiology", "human anatomy", "physiology",
    "ecology", "environmental science", "environmental science & ecology",
    "cell biology", "molecular biology", "immunology"
  ],
  "Commerce": [
    "commerce", "accountancy", "accounting", "accounts", "bookkeeping",
    "business studies", "business administration", "management",
    "economics", "microeconomics", "macroeconomics", "economics (micro & macro)",
    "financial management", "banking & insurance", "banking", "insurance", "auditing",
    "marketing management", "marketing", "human resource management", "corporate law",
    "business law", "taxation"
  ],
  "Social Science": [
    "social science", "history", "indian history", "world history", "modern history",
    "ancient history", "geography", "political science", "political science & civics",
    "civics", "constitution", "sociology", "psychology", "philosophy",
    "public administration", "journalism & mass media", "journalism", "mass media",
    "general knowledge", "gk", "general knowledge (gk) & current affairs", "current affairs"
  ],
  "Engineering": [
    "engineering", "electrical & electronics engineering", "electrical engineering",
    "electronics & communication engineering", "electronics engineering", "ece", "eee",
    "mechanical engineering", "civil engineering", "chemical engineering",
    "automobile engineering", "mechatronics", "robotics", "structural engineering"
  ]
};

export const COMPREHENSIVE_SUBJECTS_AND_LANGUAGES = [
  {
    category: "Main Academic Subjects",
    items: MAIN_SUBJECTS
  }
];

export const ALL_PREDEFINED_SUBJECTS = MAIN_SUBJECTS;

export const findMainSubject = (query) => {
  if (!query) return null;
  const q = String(query).toLowerCase().trim();

  // Direct match to main subject
  for (const mainSub of MAIN_SUBJECTS) {
    const mainLower = mainSub.toLowerCase();
    if (q === mainLower || q.includes(mainLower) || mainLower.includes(q)) {
      return mainSub;
    }
  }

  // Check sub-subjects mapping
  for (const [mainSub, subList] of Object.entries(MAIN_SUBJECT_SUB_MAP)) {
    for (const sub of subList) {
      if (q === sub || q.includes(sub) || sub.includes(q)) {
        return mainSub;
      }
    }
  }

  return null;
};

export const isSubjectMatching = (itemSubject, activeSubject) => {
  if (!activeSubject || activeSubject === 'ALL' || activeSubject === 'All Subjects') return true;
  if (!itemSubject || itemSubject === 'General' || itemSubject === 'All' || itemSubject === 'General Assessment' || itemSubject === 'Assessment') return true;
  const item = String(itemSubject).toLowerCase().trim();
  const active = String(activeSubject).toLowerCase().trim();

  if (item === active || item.includes(active) || active.includes(item)) return true;

  // Resolve activeSubject to its main subject
  const activeMain = MAIN_SUBJECTS.find(m => m.toLowerCase() === active) || findMainSubject(active) || activeSubject;
  const subList = MAIN_SUBJECT_SUB_MAP[activeMain];
  if (subList) {
    if (subList.some(sub => item === sub || item.includes(sub) || sub.includes(item))) {
      return true;
    }
  }

  // Resolve itemSubject to its main subject and check if it matches activeMain
  const itemMain = findMainSubject(item);
  if (itemMain && itemMain.toLowerCase() === activeMain.toLowerCase()) {
    return true;
  }

  return false;
};

export const SUBJECT_DATA_BANKS = {
  'Computer Science': {
    exams: [
      {
        id: 'cs-bank-exam-1',
        title: 'Computer Networks & Operating Systems Assessment',
        subject: 'Computer Science',
        date: '2026-10-20',
        time: '10:00 AM',
        duration: '60 min',
        durationMinutes: 60,
        status: 'Active',
        instructions: 'Read and answer each theory question carefully using voice navigation.',
        questions: [
          {
            id: 1,
            text: 'What is the primary role of the Transport Layer in the OSI 7-layer reference model?',
            type: 'MCQ',
            options: ['End-to-end communication and data flow control', 'Physical signal transmission over copper cables', 'Pixel rendering on display devices', 'IP packet routing across intermediate hops'],
            correctAnswer: 'End-to-end communication and data flow control',
            marks: 2
          },
          {
            id: 2,
            text: 'Explain the fundamental difference between TCP and UDP protocols in computer networking.',
            type: 'Descriptive Theory',
            options: [],
            correctAnswer: 'TCP is connection-oriented and ensures reliable, ordered packet delivery with error checking, whereas UDP is connectionless and prioritized for low-latency streaming.',
            marks: 5
          },
          {
            id: 3,
            text: 'True or False: DNS translates human-readable domain names into numerical IP addresses.',
            type: 'True/False',
            options: ['True', 'False'],
            correctAnswer: 'True',
            marks: 2
          },
          {
            id: 4,
            text: 'Describe the main function of an operating system virtual memory paging mechanism.',
            type: 'Descriptive Theory',
            options: [],
            correctAnswer: 'Virtual memory allows execution of processes larger than physical RAM by paging memory chunks between RAM and disk storage.',
            marks: 5
          },
          {
            id: 5,
            text: 'Which protocol is standard for secure encrypted web communication?',
            type: 'MCQ',
            options: ['HTTPS', 'FTP', 'Telnet', 'HTTP'],
            correctAnswer: 'HTTPS',
            marks: 2
          }
        ]
      },
      {
        id: 'cs-bank-exam-2',
        title: 'Python Programming & Data Structures Practical Exam',
        subject: 'Computer Science',
        date: '2026-10-24',
        time: '02:00 PM',
        duration: '45 min',
        durationMinutes: 45,
        status: 'Scheduled',
        instructions: 'Python programming syntax and algorithmic complexity evaluation.',
        questions: [
          {
            id: 1,
            text: 'What is the time complexity of searching an element in a balanced binary search tree?',
            type: 'MCQ',
            options: ['O(log n)', 'O(n^2)', 'O(n!)', 'O(1)'],
            correctAnswer: 'O(log n)',
            marks: 2
          },
          {
            id: 2,
            text: 'Describe the difference between mutable and immutable data types in Python with examples.',
            type: 'Descriptive Theory',
            options: [],
            correctAnswer: 'Mutable objects such as lists and dictionaries can be changed in place, whereas immutable objects like tuples and strings cannot be altered once created.',
            marks: 5
          },
          {
            id: 3,
            text: 'What is a deadlock and what are the four Coffman conditions required for it to occur?',
            type: 'Descriptive Theory',
            options: [],
            correctAnswer: 'A deadlock is a situation where two or more processes cannot proceed because each is waiting for the other. The four conditions are mutual exclusion, hold and wait, no preemption, and circular wait.',
            marks: 6
          }
        ]
      }
    ],
    studyMaterials: [
      {
        id: 'cs-mat-1',
        title: 'Operating Systems: Process Scheduling & Deadlock Prevention',
        type: 'Audio Lesson',
        subject: 'Computer Science',
        detail: 'Core principles of CPU scheduling algorithms (FCFS, Round Robin, Priority) and Coffman deadlock conditions.',
        textContent: 'Operating systems manage CPU scheduling using algorithms like First-Come-First-Serve, Shortest Job First, and Round Robin time slicing. A deadlock occurs when processes hold resources and wait indefinitely for resources held by others. Prevention involves eliminating mutual exclusion, hold and wait, no preemption, or circular wait.',
        practiceQuestion: 'What are the four Coffman conditions required for an operating system deadlock to occur?',
        practiceAnswer: 'Mutual exclusion, hold and wait, no preemption, and circular wait.',
        oneLineAnswer: 'Mutual exclusion, hold and wait, no preemption, and circular wait.',
        explanation: 'For a deadlock to arise, all four Coffman conditions must hold simultaneously. Breaking any single condition prevents deadlock.'
      },
      {
        id: 'cs-mat-2',
        title: 'Computer Networks: TCP/IP Stack & Routing Protocols',
        type: 'Audio Lesson',
        subject: 'Computer Science',
        detail: 'Detailed walkthrough of the 7 OSI layers, TCP three-way handshake, and IP routing mechanisms.',
        textContent: 'Computer networks connect distributed systems using standardized protocol layers. The Transport layer provides end-to-end communication via reliable TCP or lightweight UDP. The Network layer routes IP packets across diverse network segments using routing algorithms such as Dijkstra link-state and Bellman-Ford distance-vector.',
        practiceQuestion: 'Explain the three-way handshake mechanism used by TCP to establish a connection.',
        practiceAnswer: 'SYN packet from client, SYN-ACK response from server, and final ACK acknowledgment from client.',
        oneLineAnswer: 'Client sends SYN, server responds with SYN-ACK, client acknowledges with ACK.',
        explanation: 'The TCP three-way handshake synchronizes sequence numbers between client and server, establishing a reliable bidirectional communication socket.'
      }
    ],
    oralVivas: [
      {
        id: 'cs-viva-1',
        title: 'Computer Science & Operating Systems Oral Viva',
        subject: 'Computer Science',
        questions: [
          { id: 1, text: 'Explain the concept of virtual memory and how page faults are resolved by the OS kernel.', keywords: ['virtual memory', 'page fault', 'ram', 'paging', 'disk'] },
          { id: 2, text: 'What is the key difference between a process and a thread in terms of memory sharing?', keywords: ['process', 'thread', 'memory', 'shared', 'address space'] },
          { id: 3, text: 'Describe how TCP ensures reliable data transmission over an unreliable physical network.', keywords: ['acknowledgment', 'retransmission', 'sequence', 'checksum', 'handshake'] }
        ]
      },
      {
        id: 'cs-viva-2',
        title: 'Python Programming & Architecture Viva',
        subject: 'Computer Science',
        questions: [
          { id: 1, text: 'Explain the role of the Python Global Interpreter Lock (GIL) in multi-threading.', keywords: ['gil', 'thread', 'interpreter', 'concurrency', 'lock'] },
          { id: 2, text: 'What are Python decorators and how do they modify function behavior dynamically?', keywords: ['decorator', 'wrapper', 'function', 'syntax', 'closure'] }
        ]
      }
    ],
    results: []
  },

  'Science': {
    exams: [
      {
        id: 'sci-bank-exam-1',
        title: 'Science: Physics Laws of Motion & Energy Dynamics',
        subject: 'Science',
        date: '2026-10-20',
        time: '10:00 AM',
        duration: '60 min',
        durationMinutes: 60,
        status: 'Active',
        instructions: 'Listen to each physics problem and state your answers clearly.',
        questions: [
          {
            id: 1,
            text: 'According to Newton’s First Law of Motion, what does an object in motion do unless acted on by an external net force?',
            type: 'MCQ',
            options: ['Continues moving with constant velocity', 'Instantly decelerates to rest', 'Accelerates exponentially', 'Reverses its trajectory'],
            correctAnswer: 'Continues moving with constant velocity',
            marks: 2
          },
          {
            id: 2,
            text: 'State Newton’s Second Law of Motion and explain the relationship between force, mass, and acceleration.',
            type: 'Descriptive Theory',
            options: [],
            correctAnswer: 'Force equals mass times acceleration (F = m * a). Acceleration is directly proportional to net force and inversely proportional to mass.',
            marks: 5
          },
          {
            id: 3,
            text: 'What is the law of conservation of energy?',
            type: 'Descriptive Theory',
            options: [],
            correctAnswer: 'Energy cannot be created or destroyed; it can only be transformed from one form to another.',
            marks: 5
          },
          {
            id: 4,
            text: 'Which organelle is universally known as the powerhouse of the biological eukaryotic cell?',
            type: 'MCQ',
            options: ['Mitochondria', 'Endoplasmic reticulum', 'Golgi apparatus', 'Ribosome'],
            correctAnswer: 'Mitochondria',
            marks: 2
          },
          {
            id: 5,
            text: 'True or False: Photosynthesis converts light energy into chemical energy stored in glucose molecules.',
            type: 'True/False',
            options: ['True', 'False'],
            correctAnswer: 'True',
            marks: 2
          }
        ]
      },
      {
        id: 'sci-bank-exam-2',
        title: 'Science: Chemistry Periodic Trends & Chemical Reactions',
        subject: 'Science',
        date: '2026-10-24',
        time: '02:00 PM',
        duration: '45 min',
        durationMinutes: 45,
        status: 'Scheduled',
        instructions: 'Chemical bonds, reaction equilibria, and periodic classification questions.',
        questions: [
          {
            id: 1,
            text: 'What is the pH value of pure neutral distilled water at 25 degrees Celsius?',
            type: 'MCQ',
            options: ['7', '0', '14', '5'],
            correctAnswer: '7',
            marks: 2
          },
          {
            id: 2,
            text: 'Explain the difference between exothermic and endothermic chemical reactions.',
            type: 'Descriptive Theory',
            options: [],
            correctAnswer: 'Exothermic reactions release thermal energy to the surroundings, while endothermic reactions absorb heat energy from the surroundings.',
            marks: 5
          },
          {
            id: 3,
            text: 'Describe the key components and function of the human circulatory system.',
            type: 'Descriptive Theory',
            options: [],
            correctAnswer: 'The circulatory system consists of the heart, blood vessels (arteries, veins, capillaries), and blood, transporting oxygen, nutrients, and waste products throughout the body.',
            marks: 6
          }
        ]
      }
    ],
    studyMaterials: [
      {
        id: 'sci-mat-1',
        title: 'Physics: Newton’s Laws of Motion & Energy Dynamics',
        type: 'Audio Lesson',
        subject: 'Science',
        detail: 'Foundational physics lecture on inertia, momentum, kinetic energy, and gravitational force.',
        textContent: 'Isaac Newton formulated three fundamental laws of classical mechanics. First is inertia: objects resist changes in their velocity. Second is F equals m times a: force produces proportional acceleration. Third is action and reaction: every action has an equal and opposite reaction force. Energy is conserved across all physical transformations.',
        practiceQuestion: 'State Newton’s Third Law of Motion and give a practical everyday example.',
        practiceAnswer: 'For every action force, there is an equal and opposite reaction force, such as a swimmer pushing water backward to propel forward.',
        oneLineAnswer: 'For every action, there is an equal and opposite reaction.',
        explanation: 'Forces always occur in matched interaction pairs acting on two different interacting bodies.'
      },
      {
        id: 'sci-mat-2',
        title: 'Chemistry: Periodic Table, Bonding & Chemical Reactions',
        type: 'Audio Lesson',
        subject: 'Science',
        detail: 'Atomic structure, electron configurations, ionic and covalent bonding, and acid-base neutralization.',
        textContent: 'The periodic table arranges elements by increasing atomic number. Elements in the same group exhibit similar valence electron configurations and chemical reactivities. Atoms form ionic bonds by transferring electrons or covalent bonds by sharing electrons. In acid-base reactions, an acid donates hydrogen ions to a base forming water and salt.',
        practiceQuestion: 'What is the fundamental difference between ionic and covalent chemical bonds?',
        practiceAnswer: 'Ionic bonds involve the transfer of electrons between atoms forming ions, whereas covalent bonds involve the sharing of electron pairs.',
        oneLineAnswer: 'Ionic transfers electrons; covalent shares electron pairs.',
        explanation: 'Ionic bonding typically occurs between metals and nonmetals due to large electronegativity differences, while covalent bonding occurs between nonmetals.'
      },
      {
        id: 'sci-mat-3',
        title: 'Biology: Cell Structure, Mitochondria & Photosynthesis',
        type: 'Audio Lesson',
        subject: 'Science',
        detail: 'Cellular anatomy, chloroplast function, ATP energy production, and genetic material in the nucleus.',
        textContent: 'The biological cell is the basic structural and functional unit of all living organisms. Plant cells contain chloroplasts that capture solar photon energy to synthesize glucose through photosynthesis. Animal and plant cells possess mitochondria that perform cellular respiration, converting glucose into adenosine triphosphate (ATP) molecules.',
        practiceQuestion: 'What is the primary biochemical equation of plant photosynthesis?',
        practiceAnswer: 'Carbon dioxide plus water in the presence of sunlight and chlorophyll yields glucose and oxygen gas.',
        oneLineAnswer: '6CO2 + 6H2O + Light yields C6H12O6 + 6O2.',
        explanation: 'Photosynthesis transforms inorganic carbon dioxide and water into energy-rich organic sugar molecules while releasing breathable oxygen.'
      }
    ],
    oralVivas: [
      {
        id: 'sci-viva-1',
        title: 'General Science & Physics Voice Viva',
        subject: 'Science',
        questions: [
          { id: 1, text: 'State Newton’s Second Law of Motion and define how acceleration depends on mass and net force.', keywords: ['force', 'mass', 'acceleration', 'f=ma', 'newton'] },
          { id: 2, text: 'Explain the principle of conservation of mechanical energy with the example of a swinging pendulum.', keywords: ['conservation', 'energy', 'kinetic', 'potential', 'pendulum'] },
          { id: 3, text: 'What is the difference between speed and velocity in physics vector analysis?', keywords: ['scalar', 'vector', 'direction', 'magnitude', 'velocity'] }
        ]
      },
      {
        id: 'sci-viva-2',
        title: 'Chemistry & Biology Life Sciences Oral Viva',
        subject: 'Science',
        questions: [
          { id: 1, text: 'Describe the structural difference between plant and animal cells.', keywords: ['cell wall', 'chloroplast', 'vacuole', 'mitochondria', 'membrane'] },
          { id: 2, text: 'Explain what happens during an exothermic chemical reaction at the molecular level.', keywords: ['exothermic', 'heat', 'energy', 'bonds', 'temperature'] }
        ]
      }
    ],
    results: []
  },

  'History': {
    exams: [
      {
        id: 'hist-bank-exam-1',
        title: 'World History: Ancient Civilizations & Global Treaties Assessment',
        subject: 'History',
        date: '2026-10-20',
        time: '10:00 AM',
        duration: '60 min',
        durationMinutes: 60,
        status: 'Active',
        instructions: 'Answer each historical analysis and world civilization question.',
        questions: [
          {
            id: 1,
            text: 'Which ancient civilization was renowned for its advanced urban grid planning, standardized baked bricks, and the Great Bath at Mohenjo-Daro?',
            type: 'MCQ',
            options: ['Indus Valley Civilization', 'Mayan Civilization', 'Roman Empire', 'Mesopotamian Empire'],
            correctAnswer: 'Indus Valley Civilization',
            marks: 2
          },
          {
            id: 2,
            text: 'Explain the primary causes and global consequences of the Industrial Revolution in the 18th and 19th centuries.',
            type: 'Descriptive Theory',
            options: [],
            correctAnswer: 'The Industrial Revolution mechanized manufacturing through steam power and iron production, causing massive urbanization, economic expansion, and societal restructuring.',
            marks: 5
          },
          {
            id: 3,
            text: 'What was the historical significance of the Silk Road in world trade and cultural diffusion?',
            type: 'Descriptive Theory',
            options: [],
            correctAnswer: 'The Silk Road connected East Asia with the Mediterranean, facilitating the international exchange of silk, spices, technologies, philosophies, and religions.',
            marks: 5
          },
          {
            id: 4,
            text: 'In which year did the United Nations officially form following the conclusion of World War II?',
            type: 'MCQ',
            options: ['1945', '1918', '1939', '1950'],
            correctAnswer: '1945',
            marks: 2
          },
          {
            id: 5,
            text: 'True or False: The Magna Carta of 1215 established the fundamental principle that even the monarch is subject to the rule of law.',
            type: 'True/False',
            options: ['True', 'False'],
            correctAnswer: 'True',
            marks: 2
          }
        ]
      },
      {
        id: 'hist-bank-exam-2',
        title: 'Modern Indian History: National Freedom Struggle Examination',
        subject: 'History',
        date: '2026-10-25',
        time: '11:00 AM',
        duration: '50 min',
        durationMinutes: 50,
        status: 'Scheduled',
        instructions: 'Indian national movement, non-violence principles, and the drafting of the Constitution.',
        questions: [
          {
            id: 1,
            text: 'Who served as the Chairman of the Drafting Committee of the Indian Constitution?',
            type: 'MCQ',
            options: ['Dr. B.R. Ambedkar', 'Jawaharlal Nehru', 'Mahatma Gandhi', 'Sardar Vallabhbhai Patel'],
            correctAnswer: 'Dr. B.R. Ambedkar',
            marks: 2
          },
          {
            id: 2,
            text: 'Discuss the historical significance and impact of the Dandi Salt March led by Mahatma Gandhi in 1930.',
            type: 'Descriptive Theory',
            options: [],
            correctAnswer: 'The Salt March was a 240-mile nonviolent civil disobedience campaign protesting the British salt monopoly, sparking nationwide participation.',
            marks: 5
          },
          {
            id: 3,
            text: 'Explain the salient features of the preamble to the Indian Constitution.',
            type: 'Descriptive Theory',
            options: [],
            correctAnswer: 'Declares India as a Sovereign, Socialist, Secular, Democratic Republic securing Justice, Liberty, Equality, and Fraternity for all citizens.',
            marks: 6
          }
        ]
      }
    ],
    studyMaterials: [
      {
        id: 'hist-mat-1',
        title: 'Ancient Civilizations: Indus Valley Urban Architecture & Trade',
        type: 'Audio Lesson',
        subject: 'History',
        detail: 'Comprehensive overview of Harappa, Mohenjo-Daro, grid drainage systems, and maritime trading networks.',
        textContent: 'The Indus Valley Civilization flourished around 2500 BCE across northwestern South Asia. Cities like Harappa and Mohenjo-Daro were planned with sophisticated street grids, multi-storey brick homes, covered underground sewer drainage systems, and large granaries. Artifacts such as steatite seals and carnelian beads demonstrate vibrant long-distance trade with Mesopotamia.',
        practiceQuestion: 'What are the defining architectural features of the Indus Valley Civilization cities?',
        practiceAnswer: 'Grid-pattern urban planning, standardized burnt brick construction, advanced covered drainage networks, and public bath facilities.',
        oneLineAnswer: 'Grid street layout, standardized burnt bricks, and covered drainage systems.',
        explanation: 'Harappan urban planning exhibited a level of sanitation and municipal engineering unmatched in the ancient Bronze Age world.'
      },
      {
        id: 'hist-mat-2',
        title: 'Modern Indian History: Freedom Movement & 1947 Independence',
        type: 'Audio Lesson',
        subject: 'History',
        detail: 'Key milestones of the Indian national struggle: Non-Cooperation, Civil Disobedience, Quit India, and partition.',
        textContent: 'The Indian freedom movement brought diverse communities together against British colonial rule. Under Mahatma Gandhi’s leadership, mass campaigns utilized Satyagraha and non-violent resistance. Landmark movements included the 1920 Non-Cooperation Movement, the 1930 Dandi Salt March, and the 1942 Quit India Movement, culminating in independence on August 15, 1947.',
        practiceQuestion: 'What was the core philosophy of Satyagraha introduced during the Indian national movement?',
        practiceAnswer: 'Satyagraha means holding firmly to truth and non-violent moral resistance against injustice without hatred toward the adversary.',
        oneLineAnswer: 'Holding to truth through peaceful non-violent civil resistance.',
        explanation: 'Satyagraha mobilized millions of citizens to boycott colonial taxes and institutions through ethical non-cooperation.'
      },
      {
        id: 'hist-mat-3',
        title: 'World History: Industrial Revolution, Empires & Global Treaties',
        type: 'Audio Lesson',
        subject: 'History',
        detail: 'The transition from agrarian craft economies to industrial factory manufacturing and its socio-political impact.',
        textContent: 'Starting in Britain in the mid-1700s, the Industrial Revolution revolutionized world production using coal, steam engines, and textile machinery. It led to rapid urban migration, the rise of modern corporations, and labor rights movements. The increased demand for raw materials and markets also intensified imperial expansion across Africa and Asia.',
        practiceQuestion: 'How did the steam engine transform manufacturing and transportation during the Industrial Revolution?',
        practiceAnswer: 'The steam engine powered automated factory machinery and enabled steam locomotives and steamships, slashing transit times globally.',
        oneLineAnswer: 'Powered automated factory looms and enabled railroad and steamship transit.',
        explanation: 'James Watt’s improved steam engine freed manufacturing from dependency on watermills, allowing factories anywhere.'
      }
    ],
    oralVivas: [
      {
        id: 'hist-viva-1',
        title: 'World History & Ancient Civilizations Oral Viva',
        subject: 'History',
        questions: [
          { id: 1, text: 'Discuss the urban planning and sanitation systems of the Indus Valley Civilization.', keywords: ['indus valley', 'grid', 'drainage', 'mohenjo-daro', 'harappa'] },
          { id: 2, text: 'What was the Silk Road and how did it influence international commerce and cultural exchange?', keywords: ['silk road', 'trade', 'asia', 'europe', 'commerce', 'culture'] },
          { id: 3, text: 'Explain the constitutional significance of the Magna Carta signed in England in 1215.', keywords: ['magna carta', 'law', 'king', 'rights', 'constitution'] }
        ]
      },
      {
        id: 'hist-viva-2',
        title: 'Modern Indian History & Constitution Voice Viva',
        subject: 'History',
        questions: [
          { id: 1, text: 'Explain the historical impact of the 1930 Dandi Salt March led by Mahatma Gandhi.', keywords: ['dandi', 'salt march', 'gandhi', 'satyagraha', 'british'] },
          { id: 2, text: 'Describe the contribution of Dr. B.R. Ambedkar in framing the Constitution of India.', keywords: ['ambedkar', 'constitution', 'drafting', 'rights', 'equality'] }
        ]
      }
    ],
    results: []
  },

  'Mathematics': {
    exams: [
      {
        id: 'math-bank-exam-1',
        title: 'Mathematics: Linear Algebra & Coordinate Geometry Assessment',
        subject: 'Mathematics',
        date: '2026-10-20',
        time: '10:00 AM',
        duration: '60 min',
        durationMinutes: 60,
        status: 'Active',
        instructions: 'Solve algebraic equations and geometry problems with voice input.',
        questions: [
          {
            id: 1,
            text: 'What is the determinant of a 2x2 matrix with rows [3, 2] and [1, 4]?',
            type: 'MCQ',
            options: ['10', '14', '7', '12'],
            correctAnswer: '10',
            marks: 2
          },
          {
            id: 2,
            text: 'State and prove the Pythagorean Theorem in Euclidean Geometry.',
            type: 'Descriptive Theory',
            options: [],
            correctAnswer: 'In a right-angled triangle, the square of the hypotenuse is equal to the sum of the squares of the other two sides (a^2 + b^2 = c^2).',
            marks: 5
          },
          {
            id: 3,
            text: 'Define what eigenvalues and eigenvectors of a square matrix represent geometrically.',
            type: 'Descriptive Theory',
            options: [],
            correctAnswer: 'An eigenvector is a non-zero vector whose direction remains unchanged when a linear transformation is applied, scaled by its corresponding eigenvalue.',
            marks: 5
          },
          {
            id: 4,
            text: 'What is the derivative of f(x) = x^3 with respect to x?',
            type: 'MCQ',
            options: ['3x^2', 'x^2', '3x', '6x'],
            correctAnswer: '3x^2',
            marks: 2
          },
          {
            id: 5,
            text: 'True or False: The integral of a function represents the net signed area under its curve on a given interval.',
            type: 'True/False',
            options: ['True', 'False'],
            correctAnswer: 'True',
            marks: 2
          }
        ]
      }
    ],
    studyMaterials: [
      {
        id: 'math-mat-1',
        title: 'Linear Algebra: Matrices, Determinants & Vector Spaces',
        type: 'Audio Lesson',
        subject: 'Mathematics',
        detail: 'Matrix operations, determinants, inverses, rank, and solving systems of linear equations.',
        textContent: 'Linear algebra studies linear combinations, vector spaces, and linear transformations represented by matrices. Determinants measure the scaling factor of a matrix transformation. A system of linear equations has a unique solution if and only if the coefficient matrix is invertible with a non-zero determinant.',
        practiceQuestion: 'How is the inverse of an invertible 2x2 matrix calculated?',
        practiceAnswer: 'Divide the adjugate matrix by the non-zero determinant of the original matrix.',
        oneLineAnswer: '1 divided by determinant multiplied by the swapped diagonal adjugate matrix.',
        explanation: 'For a matrix [a, b; c, d], the inverse is (1/(ad - bc)) * [d, -b; -c, a].'
      }
    ],
    oralVivas: [
      {
        id: 'math-viva-1',
        title: 'Applied Mathematics & Algebra Oral Viva',
        subject: 'Mathematics',
        questions: [
          { id: 1, text: 'What is an eigenvalue and eigenvector of a matrix in linear transformation theory?', keywords: ['eigenvalue', 'eigenvector', 'matrix', 'transformation', 'vector'] },
          { id: 2, text: 'Explain the Fundamental Theorem of Calculus relating differentiation and integration.', keywords: ['calculus', 'derivative', 'integral', 'area', 'rate of change'] }
        ]
      }
    ],
    results: []
  },

  'English': {
    exams: [
      {
        id: 'eng-bank-exam-1',
        title: 'English Literature & Reading Comprehension Assessment',
        subject: 'English',
        date: '2026-10-20',
        time: '10:00 AM',
        duration: '60 min',
        durationMinutes: 60,
        status: 'Active',
        instructions: 'Analyze literary devices, grammatical structure, and prose comprehension.',
        questions: [
          {
            id: 1,
            text: 'Which literary device involves attributing human characteristics or emotions to non-human objects or animals?',
            type: 'MCQ',
            options: ['Personification', 'Hyperbole', 'Alliteration', 'Onomatopoeia'],
            correctAnswer: 'Personification',
            marks: 2
          },
          {
            id: 2,
            text: 'Explain the central tragic flaw (hamartia) of Hamlet in William Shakespeare’s tragedy.',
            type: 'Descriptive Theory',
            options: [],
            correctAnswer: 'Hamlet’s primary tragic flaw is his chronic indecision, philosophical hesitation, and overthinking, delaying revenge until tragedy ensues.',
            marks: 5
          },
          {
            id: 3,
            text: 'Describe the grammatical rules for active versus passive voice with illustrative examples.',
            type: 'Descriptive Theory',
            options: [],
            correctAnswer: 'Active voice places the agent performing the action as the subject, whereas passive voice foregrounds the recipient of the action.',
            marks: 5
          },
          {
            id: 4,
            text: 'What is a metaphor in English rhetoric and poetry?',
            type: 'MCQ',
            options: ['A direct comparison between two unlike things without using like or as', 'A sound-mimicking word', 'An extreme intentional exaggeration', 'A question expecting no answer'],
            correctAnswer: 'A direct comparison between two unlike things without using like or as',
            marks: 2
          },
          {
            id: 5,
            text: 'True or False: An iambic pentameter contains ten syllables consisting of five iambic feet with an unstressed syllable followed by a stressed syllable.',
            type: 'True/False',
            options: ['True', 'False'],
            correctAnswer: 'True',
            marks: 2
          }
        ]
      }
    ],
    studyMaterials: [
      {
        id: 'eng-mat-1',
        title: 'English Grammar: Tenses, Voices & Complex Sentences',
        type: 'Audio Lesson',
        subject: 'English',
        detail: 'Rules of subject-verb agreement, active and passive voices, and conditional sentences.',
        textContent: 'Grammar governs sentence structure in the English language. Active voice highlights the performer of an action, making communication direct and engaging. Passive voice is employed when the action or the receiver is the focus. Perfect tenses connect actions in the past with subsequent moments in time.',
        practiceQuestion: 'Convert the sentence "The committee approved the inclusive policy" into passive voice.',
        practiceAnswer: 'The inclusive policy was approved by the committee.',
        oneLineAnswer: 'The inclusive policy was approved by the committee.',
        explanation: 'In the passive transformation, the direct object becomes the grammatical subject with the auxiliary verb "was" and the past participle.'
      }
    ],
    oralVivas: [
      {
        id: 'eng-viva-1',
        title: 'English Literature & Literary Devices Oral Viva',
        subject: 'English',
        questions: [
          { id: 1, text: 'Explain the difference between a metaphor and a simile with examples.', keywords: ['metaphor', 'simile', 'comparison', 'like', 'as'] },
          { id: 2, text: 'Discuss the concept of tragic flaw (hamartia) in classical English tragedy.', keywords: ['hamartia', 'flaw', 'tragedy', 'shakespeare', 'character'] }
        ]
      }
    ],
    results: []
  },

  'Kannada': {
    exams: [
      {
        id: 'kan-bank-exam-1',
        title: 'ಕನ್ನಡ ಸಾಹಿತ್ಯ ಮತ್ತು ವ್ಯಾಕರಣ ಮೌಲ್ಯಮಾಪನ (Kannada Literature & Grammar)',
        subject: 'Kannada',
        date: '2026-10-22',
        time: '10:00 AM',
        duration: '60 min',
        durationMinutes: 60,
        status: 'Active',
        instructions: 'ಕನ್ನಡ ಸಾಹಿತ್ಯ, ಕವಿಗಳು ಮತ್ತು ವ್ಯಾಕರಣದ ಕುರಿತ ಪ್ರಶ್ನೆಗಳಿಗೆ ಧ್ವನಿಯ ಮೂಲಕ ಉತ್ತರಿಸಿ.',
        questions: [
          {
            id: 1,
            text: 'ಕನ್ನಡ ಸಾಹಿತ್ಯದ ಆದಿಕವಿ ಯಾರು? (Who is revered as the Adi Kavi of Kannada?)',
            type: 'MCQ',
            options: ['ಪಂಪ (Pampa)', 'ರನ್ನ (Ranna)', 'ಕುಮಾರವ್ಯಾಸ (Kumaravyasa)', 'ಹರಿಹರ (Harihara)'],
            correctAnswer: 'ಪಂಪ (Pampa)',
            marks: 2
          },
          {
            id: 2,
            text: 'ವಚನ ಸಾಹಿತ್ಯದ ಪ್ರಮುಖ ಲಕ್ಷಣಗಳನ್ನು ಮತ್ತು ಬಸವಣ್ಣನವರ ಕೊಡುಗೆಯನ್ನು ವಿವರಿಸಿ.',
            type: 'Descriptive Theory',
            options: [],
            correctAnswer: 'ವಚನ ಸಾಹಿತ್ಯವು ಸರಳ ಕನ್ನಡದಲ್ಲಿ ಸಾಮಾಜಿಕ ಸಮಾನತೆ ಮತ್ತು ಕಾಯಕ ತತ್ವವನ್ನು ಬೋಧಿಸಿದ ಚಳವಳಿಯಾಗಿದೆ.',
            marks: 5
          },
          {
            id: 3,
            text: 'ಕನ್ನಡ ವರ್ಣಮಾಲೆಯಲ್ಲಿ ಒಟ್ಟು ಎಷ್ಟು ಅಕ್ಷರಗಳಿವೆ? (How many letters in Kannada alphabet?)',
            type: 'MCQ',
            options: ['49', '50', '52', '48'],
            correctAnswer: '49',
            marks: 2
          },
          {
            id: 4,
            text: 'ಸಂಧಿ ಎಂದರೇನು? ಕನ್ನಡದ ಲೋಪ ಮತ್ತು ಆಗಮ ಸಂಧಿಗಳನ್ನು ಉದಾಹರಣೆಯೊಂದಿಗೆ ವಿವರಿಸಿ.',
            type: 'Descriptive Theory',
            options: [],
            correctAnswer: 'ಎರಡು ವರ್ಣಗಳು ಕಾಲವಿಳಂಬವಿಲ್ಲದೆ ಕೂಡುವುದೇ ಸಂಧಿ. ಉದಾಹರಣೆಗೆ: ಮಾತು+ಇಲ್ಲ = ಮಾತಿಲ್ಲ (ಲೋಪ ಸಂಧಿ), ಮನೆ+ಅನ್ನು = ಮನೆಯನ್ನು (ಆಗಮ ಸಂಧಿ).',
            marks: 5
          },
          {
            id: 5,
            text: 'True or False: ಕವಿರಾಜಮಾರ್ಗವು ಕನ್ನಡದಲ್ಲಿ ದೊರೆತಿರುವ ಅತ್ಯಂತ ಪ್ರಾಚೀನ ಲಕ್ಷಣ ಗ್ರಂಥವಾಗಿದೆ.',
            type: 'True/False',
            options: ['True', 'False'],
            correctAnswer: 'True',
            marks: 2
          }
        ]
      }
    ],
    studyMaterials: [
      {
        id: 'kan-mat-1',
        title: 'ಕನ್ನಡ ವ್ಯಾಕರಣ: ಸಂಧಿಗಳು, ಸಮಾಸಗಳು ಮತ್ತು ವಿಭಕ್ತಿ ಪ್ರತ್ಯಯಗಳು',
        type: 'Audio Lesson',
        subject: 'Kannada',
        detail: 'ಕನ್ನಡ ಭಾಷೆಯ ವ್ಯಾಕರಣದ ಮೂಲಾಂಶಗಳು, ಸಂಧಿ ನಿಯಮಗಳು ಮತ್ತು ವಿಭಕ್ತಿ ರೂಪಗಳು.',
        textContent: 'ಕನ್ನಡ ವ್ಯಾಕರಣದಲ್ಲಿ ಸ್ವರ, ವ್ಯಂಜನ ಮತ್ತು ಯೋಗವಾಹಗಳ ವರ್ಗೀಕರಣ ಅತ್ಯಂತ ಮಹತ್ವದ್ದು. ಸಂಧಿಗಳಲ್ಲಿ ಕನ್ನಡ ಸಂಧಿಗಳು ಮತ್ತು ಸಂಸ್ಕೃತ ಸಂಧಿಗಳು ಎಂಬ ಎರಡು ಮುಖ್ಯ ಪ್ರಕಾರಗಳಿವೆ. ವಿಭಕ್ತಿ ಪ್ರತ್ಯಯಗಳು ನಾಮಪದಗಳ ಸಂಬಂಧವನ್ನು ವಾಕ್ಯದಲ್ಲಿ ಸ್ಪಷ್ಟಪಡಿಸುತ್ತವೆ.',
        practiceQuestion: 'ಕನ್ನಡ ವರ್ಣಮಾಲೆಯಲ್ಲಿ ಸ್ವರಾಕ್ಷರಗಳು ಎಷ್ಟು?',
        practiceAnswer: '13 ಸ್ವರಾಕ್ಷರಗಳು ಇವೆ.',
        oneLineAnswer: '13 ಸ್ವರಗಳು.',
        explanation: 'ಹ್ರಸ್ವ ಸ್ವರಗಳು ಮತ್ತು ದೀರ್ಘ ಸ್ವರಗಳು ಒಟ್ಟುಗೂಡಿ 13 ಸ್ವರಗಳಾಗಿವೆ.'
      }
    ],
    oralVivas: [
      {
        id: 'kan-viva-1',
        title: 'ಕನ್ನಡ ಭಾಷಾ ಪ್ರೌಢಿಮೆ ಮತ್ತು ಸಾಹಿತ್ಯ ಮೌಖಿಕ ಪರೀಕ್ಷೆ (Kannada Oral Viva)',
        subject: 'Kannada',
        questions: [
          { id: 1, text: 'ಕನ್ನಡದ ಜ್ಞಾನಪೀಠ ಪ್ರಶಸ್ತಿ ಪುರಸ್ಕೃತ ಸಾಹಿತಿಗಳ ಬಗ್ಗೆ ತಿಳಿಸಿ.', keywords: ['ಕುವೆಂಪು', 'ಬೇಂದ್ರೆ', 'ಕಾರಂತ', 'ಜ್ಞಾನಪೀಠ'] },
          { id: 2, text: 'ವಚನಕಾರರ ಪ್ರಮುಖ ಸಂದೇಶಗಳೇನು?', keywords: ['ಕಾಯಕ', 'ಸಮಾನತೆ', 'ದಯೆ', 'ಬಸವಣ್ಣ'] }
        ]
      }
    ],
    results: []
  },

  'Hindi': {
    exams: [
      {
        id: 'hin-bank-exam-1',
        title: 'हिंदी साहित्य एवं व्यावहारिक व्याकरण मूल्यांकन (Hindi Literature & Grammar)',
        subject: 'Hindi',
        date: '2026-10-22',
        time: '10:00 AM',
        duration: '60 min',
        durationMinutes: 60,
        status: 'Active',
        instructions: 'सभी प्रश्नों को ध्यान से सुनें और मौखिक उत्तर दें।',
        questions: [
          {
            id: 1,
            text: 'हिंदी साहित्य के भक्तिकाल के निर्गुण काव्यधारा के प्रमुख कवि कौन हैं?',
            type: 'MCQ',
            options: ['कबीरदास (Kabirdas)', 'तुलसीदास (Tulsidas)', 'सूरदास (Surdas)', 'केशवदास (Keshavdas)'],
            correctAnswer: 'कबीरदास (Kabirdas)',
            marks: 2
          },
          {
            id: 2,
            text: 'संज्ञा के भेद बताते हुए जातिवाचक और व्यक्तिवाचक संज्ञा में अंतर स्पष्ट कीजिए।',
            type: 'Descriptive Theory',
            options: [],
            correctAnswer: 'व्यक्तिवाचक संज्ञा किसी विशेष व्यक्ति, वस्तु या स्थान का बोध कराती है, जबकि जातिवाचक संज्ञा पूरी जाति या श्रेणी का बोध कराती है।',
            marks: 5
          },
          {
            id: 3,
            text: 'मुंशी प्रेमचंद के दो प्रसिद्ध उपन्यासों के नाम लिखिए।',
            type: 'Descriptive Theory',
            options: [],
            correctAnswer: 'गोदान और गबन मुंशी प्रेमचंद के अत्यंत प्रसिद्ध उपन्यास हैं।',
            marks: 4
          },
          {
            id: 4,
            text: 'True or False: संधि दो वर्णों के मेल से होने वाले विकार को कहते हैं।',
            type: 'True/False',
            options: ['True', 'False'],
            correctAnswer: 'True',
            marks: 2
          }
        ]
      }
    ],
    studyMaterials: [
      {
        id: 'hin-mat-1',
        title: 'हिंदी व्याकरण: रस, अलंकार, संधि और समास का परिचय',
        type: 'Audio Lesson',
        subject: 'Hindi',
        detail: 'काव्य सौंदर्य के तत्व, रस सिद्धांत और व्याकरण के महत्वपूर्ण नियम।',
        textContent: 'हिंदी भाषा में व्याकरण का महत्वपूर्ण स्थान है। रस को काव्य की आत्मा कहा गया है। अलंकार काव्य की शोभा बढ़ाते हैं। संधि और समास भाषा को संक्षिप्त और प्रभावशाली बनाते हैं।',
        practiceQuestion: 'अनुप्रास अलंकार की परिभाषा क्या है?',
        practiceAnswer: 'जहाँ समान वर्णों की बार-बार आवृत्ति हो, वहाँ अनुप्रास अलंकार होता है।',
        oneLineAnswer: 'समान वर्णों की बार-बार आवृत्ति।',
        explanation: 'वर्णों की आवृत्ति से काव्य में संगीतात्मकता उत्पन्न होती है।'
      }
    ],
    oralVivas: [
      {
        id: 'hin-viva-1',
        title: 'हिंदी भाषा एवं साहित्य मौखिक परीक्षा (Hindi Oral Viva)',
        subject: 'Hindi',
        questions: [
          { id: 1, text: 'छायावाद के चार प्रमुख स्तंभों के नाम बताइए।', keywords: ['प्रसाद', 'निराला', 'पंत', 'महादेवी वर्मा'] },
          { id: 2, text: 'मुंशी प्रेमचंद की कहानियों की सामाजिक प्रासंगिकता पर विचार व्यक्त कीजिए।', keywords: ['किसान', 'समाज', 'यथार्थवाद', 'प्रेमचंद'] }
        ]
      }
    ],
    results: []
  },

  'Sanskrit': {
    exams: [
      {
        id: 'san-bank-exam-1',
        title: 'संस्कृत भाषा, व्याकरणं तथा साहित्य परीक्षा (Sanskrit Language & Grammar)',
        subject: 'Sanskrit',
        date: '2026-10-23',
        time: '10:00 AM',
        duration: '60 min',
        durationMinutes: 60,
        status: 'Active',
        instructions: 'संस्कृत व्याकरणस्य नियमान् ज्ञात्वा उत्तराणि वदन्तु।',
        questions: [
          {
            id: 1,
            text: 'संस्कृत व्याकरणस्य आदिग्रन्थः अष्टाध्यायी कस्य रचना अस्ति?',
            type: 'MCQ',
            options: ['महर्षि पाणिनिः (Panini)', 'कालिदासः (Kalidasa)', 'पतञ्जलिः (Patanjali)', 'बाणभट्टः (Banabhatta)'],
            correctAnswer: 'महर्षि पाणिनिः (Panini)',
            marks: 2
          },
          {
            id: 2,
            text: 'लकारेषु लट्-लकारः कस्य कालस्य बोधकः अस्ति?',
            type: 'MCQ',
            options: ['वर्तमानकालस्य (Present Tense)', 'भूतकालस्य (Past Tense)', 'भविष्यत्कालस्य (Future Tense)', 'आज्ञार्थे (Imperative)'],
            correctAnswer: 'वर्तमानकालस्य (Present Tense)',
            marks: 2
          },
          {
            id: 3,
            text: 'कवेः कालिदासस्य प्रसिद्धानि त्रीणि नाटकानि कानि?',
            type: 'Descriptive Theory',
            options: [],
            correctAnswer: 'अभिज्ञानशाकुन्तलम्, मालविकाग्निमित्रम्, तथा विक್ರಮೋರ್ವಶೀಯಮ್।',
            marks: 5
          },
          {
            id: 4,
            text: 'True or False: संविधे त्रिषु वचनेषु एकवचनं, द्विवचनं, बहुवचनं च भवन्ति।',
            type: 'True/False',
            options: ['True', 'False'],
            correctAnswer: 'True',
            marks: 2
          }
        ]
      }
    ],
    studyMaterials: [
      {
        id: 'san-mat-1',
        title: 'संस्कृत व्याकरणम्: सन्धिः, धातुरूपाणि तथा शब्दरूपाणि',
        type: 'Audio Lesson',
        subject: 'Sanskrit',
        detail: 'स्वरसन्धिः, व्यञ्जनसन्धिः, विसर्गसन्धिः च कारकाणां परिज्ञानम्।',
        textContent: 'संस्कृतभाषायां वर्णानां संयोजनं सन्धिः उच್ಯते। धातुभ्यः क्रियापदानि निष्पद्यन्ते। सुबन्तरूपाणि कारकैः सह अन्वयम् आप्नुवन्ति।',
        practiceQuestion: 'देव + आलयः इत्यस्य सन्धिपदं किम्?',
        practiceAnswer: 'देवालयः (दीर्घसन्धिः)',
        oneLineAnswer: 'देवालयः',
        explanation: 'अकः सवर्णे दीर्घः इति सूत्रेण अ + आ = आ भवति।'
      }
    ],
    oralVivas: [
      {
        id: 'san-viva-1',
        title: 'संस्कृत सम्भाषणम् तथा मौखिक परीक्षा (Sanskrit Oral Viva)',
        subject: 'Sanskrit',
        questions: [
          { id: 1, text: 'एकं नीतिश्लोकम् उच्चार्य तस्य भावार्थं वदतु।', keywords: ['श्लोक', 'सुभाषित', 'धर्म', 'सत्य'] },
          { id: 2, text: 'संस्कृतभाषायाः महत्त्वं किम्?', keywords: ['देववाणी', 'प्राचीन', 'विज्ञान', 'संस्कृति'] }
        ]
      }
    ],
    results: []
  },

  'Tamil': {
    exams: [
      {
        id: 'tam-bank-exam-1',
        title: 'தமிழ் இலக்கியம் மற்றும் இலக்கண மதிப்பீடு (Tamil Literature & Grammar)',
        subject: 'Tamil',
        date: '2026-10-23',
        time: '10:00 AM',
        duration: '60 min',
        durationMinutes: 60,
        status: 'Active',
        instructions: 'வினாக்களைக் கவனித்துக் கேட்டு குரல் வழியாக விடையளிக்கவும்.',
        questions: [
          {
            id: 1,
            text: 'உலகப் பொதுமறை என்று போற்றப்படும் திருக்குறளை இயற்றியவர் யார்?',
            type: 'MCQ',
            options: ['திருவள்ளுவர் (Thiruvalluvar)', 'கம்பர் (Kambar)', 'பாரதியார் (Bharathiyar)', 'ஔவையார் (Avvaiyar)'],
            correctAnswer: 'திருவள்ளுவர் (Thiruvalluvar)',
            marks: 2
          },
          {
            id: 2,
            text: 'சங்க இலக்கியத்தின் எட்டுத்தொகை மற்றும் பத்துப்பாட்டு நூல்களின் சிறப்புகளை விவரி.',
            type: 'Descriptive Theory',
            options: [],
            correctAnswer: 'சங்க இலக்கியங்கள் பண்டைத் தமிழரின் வீரம், காதல், கொடை மற்றும் வாழ்வியல் விழுமியங்களை எடுத்துக் கூறுகின்றன.',
            marks: 5
          },
          {
            id: 3,
            text: 'True or False: தமிழ் மொழி மத்திய அரசால் முதல் செம்மொழியாக அறிவிக்கப்பட்டது.',
            type: 'True/False',
            options: ['True', 'False'],
            correctAnswer: 'True',
            marks: 2
          }
        ]
      }
    ],
    studyMaterials: [
      {
        id: 'tam-mat-1',
        title: 'தமிழ் இலக்கணம்: எழுத்து, சொல் மற்றும் அணி இலக்கணம்',
        type: 'Audio Lesson',
        subject: 'Tamil',
        detail: 'தொல்காப்பியம் மற்றும் நன்னூல் அடிப்படையில் தமிழ் இலக்கண நெறிகள்.',
        textContent: 'தமிழ் இலக்கணம் ஐந்து வகைப்படும்: எழுத்து, சொல், பொருள், யாப்பு, அணி. இவை அனைத்தும் தமிழ் மொழியின் கட்டமைப்பையும் இலக்கியச் சுவையையும் மேம்படுத்துகின்றன.',
        practiceQuestion: 'திருக்குறளில் எத்தனை அதிகாரங்கள் உள்ளன?',
        practiceAnswer: '133 அதிகாரங்கள் மற்றும் 1330 குறட்பாக்கள் உள்ளன.',
        oneLineAnswer: '133 அதிகாரங்கள்.',
        explanation: 'அறத்துப்பால், பொருட்பால், காமத்துப்பால் என்ற மூன்று பால்களில் 133 அதிகாரங்கள் அடங்கியுள்ளன.'
      }
    ],
    oralVivas: [
      {
        id: 'tam-viva-1',
        title: 'தமிழ் இலக்கிய வாய்மொழித் தேர்வு (Tamil Oral Viva)',
        subject: 'Tamil',
        questions: [
          { id: 1, text: 'பாரதியாரின் விடுதலைப் பாடல்களின் மையக் கருத்து யாது?', keywords: ['விடுதலை', 'பெண்ணியம்', 'சுதந்திரம்', 'பாரதி'] },
          { id: 2, text: 'திருக்குறள் கூறும் நட்பின் சிறப்பினை விளக்குக.', keywords: ['நட்பு', 'உதவி', 'குறள்', 'வள்ளுவர்'] }
        ]
      }
    ],
    results: []
  },

  'Telugu': {
    exams: [
      {
        id: 'tel-bank-exam-1',
        title: 'తెలుగు సాహిత్యం మరియు వ్యాకరణ మూల్యాంకనం (Telugu Literature & Grammar)',
        subject: 'Telugu',
        date: '2026-10-24',
        time: '10:00 AM',
        duration: '60 min',
        durationMinutes: 60,
        status: 'Active',
        instructions: 'ప్రశ్నలను విని శబ్ద సంభాషణ ద్వారా సమాధానాలు ఇవ్వండి.',
        questions: [
          {
            id: 1,
            text: 'తెలుగు సాహిత్యంలో ఆదికవిగా ఎవరిని గౌరవిస్తారు?',
            type: 'MCQ',
            options: ['నన్నయ (Nannaya)', 'తిక్కన (Tikkana)', 'ఎర్రన (Errana)', 'పోతన (Pothana)'],
            correctAnswer: 'నన్నయ (Nannaya)',
            marks: 2
          },
          {
            id: 2,
            text: 'పోతన రచించిన శ్రీమదాంధ్ర భాగవతంలోని భక్తి తత్వాన్ని వివరించండి.',
            type: 'Descriptive Theory',
            options: [],
            correctAnswer: 'పోతన భాగవతం సహజ పాండిత్యంతో, పరమ భక్తిభావంతో మధురమైన పద్యాలలో భగవత్ తత్వాన్ని బోధిస్తుంది.',
            marks: 5
          },
          {
            id: 3,
            text: 'True or False: తెలుగు భాషను ఇటాలియన్ ఆఫ్ ది ఈస్ట్ అని నికోలో డా కాంటి పేర్కొన్నారు.',
            type: 'True/False',
            options: ['True', 'False'],
            correctAnswer: 'True',
            marks: 2
          }
        ]
      }
    ],
    studyMaterials: [
      {
        id: 'tel-mat-1',
        title: 'తెలుగు వ్యాకరణం: సంధులు, సమాసాలు మరియు ఛందస్సు',
        type: 'Audio Lesson',
        subject: 'Telugu',
        detail: 'తెలుగు సంధి నియమాలు, వృత్తాలు మరియు అలంకారాల పరిచయం.',
        textContent: 'తెలుగు భాషలో అజంత భాషగా పేరుగాంచింది. తెలుగు సంధులలో అత్వ, ఇత్వ, ఉత్వ సంధులు ప్రధానమైనవి. ఛందస్సు పద్య రచనకు లయను అందజేస్తుంది.',
        practiceQuestion: 'రాముడు + అతడు ఏ సంధి?',
        practiceAnswer: 'ఉత్వ సంధి (రాముడతడు).',
        oneLineAnswer: 'ఉత్వ సంధి.',
        explanation: 'ఉత్తునకు అచ్చు పరమగునపుడు సంధి నిత్యముగా జరుగును.'
      }
    ],
    oralVivas: [
      {
        id: 'tel-viva-1',
        title: 'తెలుగు సాహిత్య మౌఖిక పరీక్ష (Telugu Oral Viva)',
        subject: 'Telugu',
        questions: [
          { id: 1, text: 'కవిత్రయం గురించి మరియు మహాభారత ఆంధ్రీకరణ గురించి తెలపండి.', keywords: ['నన్నయ', 'తిక్కన', 'ఎర్రన', 'మహాభారతం'] },
          { id: 2, text: 'వేమన శతక పద్యాలలోని సామాజిక సందేశాన్ని వివరించండి.', keywords: ['వేమన', 'నీతి', 'సమాజం', 'విశ్వదాభిరామ'] }
        ]
      }
    ],
    results: []
  },

  'French': {
    exams: [
      {
        id: 'fre-bank-exam-1',
        title: 'Évaluation de la Langue Française, Grammaire et Littérature (French)',
        subject: 'French',
        date: '2026-10-24',
        time: '10:00 AM',
        duration: '60 min',
        durationMinutes: 60,
        status: 'Active',
        instructions: 'Écoutez attentivement chaque question et répondez par la voix.',
        questions: [
          {
            id: 1,
            text: 'Quel est le pronom personnel sujet pour la deuxième personne du pluriel en français ?',
            type: 'MCQ',
            options: ['Vous', 'Nous', 'Ils', 'Elles'],
            correctAnswer: 'Vous',
            marks: 2
          },
          {
            id: 2,
            text: 'Expliquez l\'accord du participe passé avec l\'auxiliaire "avoir".',
            type: 'Descriptive Theory',
            options: [],
            correctAnswer: 'Le participe passé conjugué avec "avoir" s\'accorde en genre et en nombre avec le complément d\'objet direct (COD) si celui-ci est placé avant le verbe.',
            marks: 5
          },
          {
            id: 3,
            text: 'True or False: En français, tous les adjectifs se placent toujours après le nom.',
            type: 'True/False',
            options: ['True', 'False'],
            correctAnswer: 'False',
            marks: 2
          }
        ]
      }
    ],
    studyMaterials: [
      {
        id: 'fre-mat-1',
        title: 'Grammaire Française: Les Temps du Passé (Passé Composé et Imparfait)',
        type: 'Audio Lesson',
        subject: 'French',
        detail: 'Maîtrise des conjugaisons, accords et expressions idiomatiques.',
        textContent: 'Le passé composé est utilisé pour des actions ponctuelles et achevées dans le passé, tandis que l\'imparfait décrit une habitude, un état d\'esprit ou le cadre d\'une situation passée.',
        practiceQuestion: 'Conjuguez le verbe "finir" à la 1ère personne du singulier au présent de l\'indicatif.',
        practiceAnswer: 'Je finis.',
        oneLineAnswer: 'Je finis.',
        explanation: 'Les verbes du 2ème groupe se terminent par -is pour la première personne du singulier.'
      }
    ],
    oralVivas: [
      {
        id: 'fre-viva-1',
        title: 'Épreuve Orale et Expression Française (French Oral Viva)',
        subject: 'French',
        questions: [
          { id: 1, text: 'Présentez-vous brièvement en français et décrivez vos passions.', keywords: ['bonjour', 'appelle', 'suis', 'aime'] },
          { id: 2, text: 'Pourquoi l\'apprentissage de la langue française est-il enrichissant ?', keywords: ['culture', 'monde', 'francophonie', 'langue'] }
        ]
      }
    ],
    results: []
  },

  'German': {
    exams: [
      {
        id: 'ger-bank-exam-1',
        title: 'Deutsche Sprach- und Grammatikprüfung (German Language & Grammar)',
        subject: 'German',
        date: '2026-10-25',
        time: '10:00 AM',
        duration: '60 min',
        durationMinutes: 60,
        status: 'Active',
        instructions: 'Hören Sie die Fragen aufmerksam an und antworten Sie mit der Stimme.',
        questions: [
          {
            id: 1,
            text: 'Welcher Artikel steht im Dativ Maskulinum Singular?',
            type: 'MCQ',
            options: ['dem', 'den', 'der', 'des'],
            correctAnswer: 'dem',
            marks: 2
          },
          {
            id: 2,
            text: 'Erklären Sie die Satzstellung in einem deutschen Nebensatz mit der Konjunktion "weil".',
            type: 'Descriptive Theory',
            options: [],
            correctAnswer: 'Im Nebensatz mit "weil" wandert das konjugierte Verb an das Satzende.',
            marks: 5
          },
          {
            id: 3,
            text: 'True or False: Alle Substantive werden im Deutschen großgeschrieben.',
            type: 'True/False',
            options: ['True', 'False'],
            correctAnswer: 'True',
            marks: 2
          }
        ]
      }
    ],
    studyMaterials: [
      {
        id: 'ger-mat-1',
        title: 'Deutsche Grammatik: Die vier Fälle (Kasus) und Präpositionen',
        type: 'Audio Lesson',
        subject: 'German',
        detail: 'Nominativ, Akkusativ, Dativ und Genitiv systematisch verstehen.',
        textContent: 'Die deutsche Grammatik basiert auf vier Fällen: Nominativ für das Subjekt, Akkusativ für das direkte Objekt, Dativ für das indirekte Objekt und Genitiv für den Besitz.',
        practiceQuestion: 'Wie lautet der Plural von "das Buch"?',
        practiceAnswer: 'Die Bücher.',
        oneLineAnswer: 'Die Bücher.',
        explanation: 'Im Plural erhält Buch einen Umlaut (ü) und die Endung -er.'
      }
    ],
    oralVivas: [
      {
        id: 'ger-viva-1',
        title: 'Mündliche Prüfung Deutsch (German Oral Viva)',
        subject: 'German',
        questions: [
          { id: 1, text: 'Stellen Sie sich bitte auf Deutsch vor.', keywords: ['hallo', 'heiße', 'wohne', 'lerne'] },
          { id: 2, text: 'Welche Vorteile hat das Erlernen der deutschen Sprache?', keywords: ['beruf', 'europa', 'studium', 'kultur'] }
        ]
      }
    ],
    results: []
  },

  'Spanish': {
    exams: [
      {
        id: 'spa-bank-exam-1',
        title: 'Evaluación de Lengua Española, Gramática y Comunicación (Spanish)',
        subject: 'Spanish',
        date: '2026-10-25',
        time: '10:00 AM',
        duration: '60 min',
        durationMinutes: 60,
        status: 'Active',
        instructions: 'Escuche atentamente cada pregunta y responda con su voz.',
        questions: [
          {
            id: 1,
            text: '¿Cuál es la primera persona del singular del verbo "tener" en presente?',
            type: 'MCQ',
            options: ['Tengo', 'Tienes', 'Tiene', 'Tenemos'],
            correctAnswer: 'Tengo',
            marks: 2
          },
          {
            id: 2,
            text: 'Explique la diferencia fundamental entre los verbos "ser" y "estar" en español.',
            type: 'Descriptive Theory',
            options: [],
            correctAnswer: '"Ser" se usa para características permanentes, identidad y origen; "estar" se usa para estados transitorios, emociones y ubicación geográfica.',
            marks: 5
          },
          {
            id: 3,
            text: 'True or False: En español, las preguntas siempre abren con el signo interrogativo invertido (¿).',
            type: 'True/False',
            options: ['True', 'False'],
            correctAnswer: 'True',
            marks: 2
          }
        ]
      }
    ],
    studyMaterials: [
      {
        id: 'spa-mat-1',
        title: 'Gramática Española: Tiempos Verbales y Usos de Subjuntivo',
        type: 'Audio Lesson',
        subject: 'Spanish',
        detail: 'Conjugaciones regulares e irregulares, modo subjuntivo y preposiciones.',
        textContent: 'El español cuenta con una rica variedad de tiempos verbales. El modo subjuntivo expresa deseos, dudas, hipótesis y emociones personales.',
        practiceQuestion: '¿Cuál es el participio pasado del verbo "escribir"?',
        practiceAnswer: 'Escrito.',
        oneLineAnswer: 'Escrito.',
        explanation: 'Escribir es un verbo irregular en su forma de participio pasado.'
      }
    ],
    oralVivas: [
      {
        id: 'spa-viva-1',
        title: 'Examen Oral de Conversación en Español (Spanish Oral Viva)',
        subject: 'Spanish',
        questions: [
          { id: 1, text: 'Preséntate en español y describe tus objetivos académicos.', keywords: ['hola', 'llamo', 'estudio', 'gusto'] },
          { id: 2, text: '¿Por qué es importante el idioma español a nivel internacional?', keywords: ['comunicación', 'cultura', 'hispanoamérica', 'idioma'] }
        ]
      }
    ],
    results: []
  }
};

export const getSubjectDataBank = (subject) => {
  const bank = SUBJECT_DATA_BANKS[subject];
  if (bank) return bank;
  const lowerSub = (subject || 'General').toLowerCase();
  return {
    exams: [
      {
        id: `exam-${lowerSub.replace(/[^a-z0-9]/g, '-')}-1`,
        title: `${subject} Foundation Exam`,
        subject: subject,
        duration: 90,
        totalMarks: 100,
        questions: [
          {
            id: 1,
            text: `What is the significance of studying ${subject}?`,
            type: 'Descriptive Theory',
            marks: 10
          }
        ]
      }
    ],
    studyMaterials: [
      {
        id: `mat-${lowerSub.replace(/[^a-z0-9]/g, '-')}-1`,
        title: `${subject} Core Concepts Audio Lesson`,
        subject: subject,
        detail: `Foundational overview and revision notes for ${subject}.`,
        textContent: `Comprehensive educational overview covering primary principles of ${subject}.`
      }
    ],
    oralVivas: [
      {
        id: `viva-${lowerSub.replace(/[^a-z0-9]/g, '-')}-1`,
        title: `${subject} Oral Viva Evaluation`,
        subject: subject,
        questions: [
          { id: 1, text: `Introduce yourself and summarize your interest in ${subject}.`, keywords: [lowerSub, 'interest', 'study'] },
          { id: 2, text: `Discuss one major topic or concept you have learned in ${subject}.`, keywords: ['topic', 'concept', 'learned'] }
        ]
      }
    ],
    results: []
  };
};

const initialExams = [];

const initialResults = [];

const initialAnnouncements = [];

export const isExamAssignedToStudent = (exam, studentEmail, studentName) => {
  if (!exam) return false;
  const cleanEmail = (studentEmail || '').toLowerCase().trim();
  const cleanName = (studentName || '').toLowerCase().trim();

  const targetEmail = String(exam.targetStudentEmail || '').toLowerCase().trim();
  const targetName = String(exam.targetStudentName || '').toLowerCase().trim();
  const assignedList = Array.isArray(exam.assignedStudents) 
    ? exam.assignedStudents.map(s => String(s).toLowerCase().trim()) 
    : [];

  const examTitle = String(exam.title || exam.examTitle || '').toLowerCase();
  const examDesc = String(exam.instructions || exam.description || '').toLowerCase();

  // 1. Explicit target email match
  if (targetEmail && cleanEmail && targetEmail === cleanEmail) {
    return true;
  }

  // 2. Explicit target name match
  if (targetName && cleanName) {
    if (targetName === cleanName || cleanName.includes(targetName) || targetName.includes(cleanName)) {
      return true;
    }
  }

  // 3. Name found in exam title or instructions
  if (cleanName && cleanName.length > 2 && (examTitle.includes(cleanName) || examDesc.includes(cleanName))) {
    return true;
  }

  // 4. Personalized exam in title or instructions
  const personalizedMatch = examTitle.match(/personalized exam for ([^:]+)/i) || 
                            examTitle.match(/assessment - ([a-z0-9 ]+)/i) ||
                            examDesc.match(/specifically for ([^.]+)/i);
  if (personalizedMatch) {
    const extractedName = personalizedMatch[1].trim().toLowerCase();
    if (extractedName && extractedName !== 'all' && extractedName !== 'blind students') {
      if (cleanName && (cleanName === extractedName || cleanName.includes(extractedName) || extractedName.includes(cleanName))) {
        return true;
      }
      return false; // Specifically created for someone else
    }
  }

  // 5. If this exam is explicitly targeted to someone else (different email or name specified)
  if (targetEmail && cleanEmail && targetEmail !== cleanEmail) {
    return false;
  }
  if (targetName && cleanName && targetName !== cleanName && !cleanName.includes(targetName) && !targetName.includes(cleanName)) {
    return false;
  }

  // 6. Assigned students list (if specified)
  if (assignedList.length > 0) {
    if (assignedList.includes('all')) return true;
    return assignedList.some(s => 
      (cleanEmail && s === cleanEmail) || 
      (cleanName && (s === cleanName || cleanName.includes(s) || s.includes(cleanName)))
    );
  }

  // 7. General exams (open to all students studying this subject)
  return true;
};

export const isNotificationForStudent = (notif, studentEmail, studentName) => {
  if (!notif) return false;
  const cleanEmail = (studentEmail || '').toLowerCase().trim();
  const cleanName = (studentName || '').toLowerCase().trim();

  const idStr = String(notif.id || '');
  // Discard legacy mock notifications
  if (idStr.startsWith('notif-1') || idStr.startsWith('notif-2') || idStr.startsWith('notif-3') ||
      idStr.startsWith('notif-4') || idStr.startsWith('notif-5') || idStr.startsWith('notif-6')) return false;

  const title = String(notif.title || '').toLowerCase();
  const detail = String(notif.detail || notif.message || '').toLowerCase();

  // Discard known fake static announcement strings
  if (title.includes('computer networks exam starts in 30 minutes')) return false;
  if (title.includes('operating systems theory assessment')) return false;
  if (title.includes('physics motion & laws of force')) return false;
  if (title.includes('computer networks & cyber security')) return false;
  if (title.includes('extra 15 mins allocated for exam')) return false;
  if (title.includes('emergency sos request resolved')) return false;

  const tEmail = String(notif.targetStudentEmail || '').toLowerCase().trim();
  const tName = String(notif.targetStudentName || '').toLowerCase().trim();

  // 1. Explicit target email check
  if (tEmail) {
    return cleanEmail && tEmail === cleanEmail;
  }

  // 2. Explicit target name check
  if (tName) {
    if (!cleanName) return false;
    return tName === cleanName || cleanName.includes(tName) || tName.includes(cleanName);
  }

  // 3. Personalized check in title/detail
  const personalizedMatch = title.match(/personalized exam for ([^:]+)/i) || 
                            detail.match(/specifically for ([^.]+)/i) ||
                            title.match(/assessment - ([a-z0-9 ]+)/i);
  if (personalizedMatch) {
    const extractedName = personalizedMatch[1].trim().toLowerCase();
    if (extractedName && extractedName !== 'all' && extractedName !== 'blind students') {
      if (!cleanName) return false;
      return cleanName === extractedName || cleanName.includes(extractedName) || extractedName.includes(cleanName);
    }
  }

  // 4. Other student name in title/detail
  const otherNames = ['nayana', 'lakshmi', 'jaanu', 'sowmya'];
  for (const stu of otherNames) {
    if (cleanName && !cleanName.includes(stu) && (title.includes(stu) || detail.includes(stu))) {
      return false;
    }
  }

  // 5. If notification is targeted to another student, exclude it
  if (tEmail && tEmail !== cleanEmail) return false;

  // 6. For new users, only show notifications if explicitly targeted to them or general broadcast
  if (!tEmail && !tName && !notif.isBroadcast) {
    return false;
  }

  return true;
};

export const isExamActiveNow = (exam) => {
  if (!exam) return false;
  const status = (exam.status || '').toLowerCase();
  if (status === 'completed') return false;
  if (status === 'active' || status === 'published') return true;
  if (status === 'scheduled') {
    if (!exam.date || exam.date === 'Upcoming') return true;
    const todayStr = new Date().toISOString().split('T')[0];
    if (exam.date <= todayStr) return true;
  }
  return true;
};

export const isExamSuccessfullyCompleted = (result) => {
  if (!result) return false;

  // Explicit termination, cancellation, disqualification, or exit flags
  if (result.isTerminated || result.terminated || result.isDisqualified || result.disqualified || result.exited) {
    return false;
  }

  const status = String(result.status || '').toLowerCase().trim();
  const feedback = String(result.feedback || '').toLowerCase();

  // If status indicates termination, disqualification, cancellation, exit, or abort
  if (
    status.includes('terminated') ||
    status.includes('disqualif') ||
    status.includes('exit') ||
    status.includes('cancel') ||
    status.includes('abort') ||
    status.includes('abandon') ||
    status.includes('draft')
  ) {
    return false;
  }

  // If feedback indicates proctor strike termination
  if (feedback.includes('terminated by ai proctor') || feedback.includes('disqualified') || feedback.includes('proctoring violations recorded')) {
    return false;
  }

  // An exam is considered completed if it has a legitimate submission status
  const validCompletedTokens = [
    'completed',
    'submitted',
    'pending correction',
    'graded',
    'evaluated',
    'needs correction',
    'pending review',
    'passed',
    'failed'
  ];
  const hasValidStatus = validCompletedTokens.some(token => status.includes(token));
  if (!hasValidStatus && status !== '') {
    return false;
  }

  // Validate that the student actually submitted answers or an evaluation took place
  const answers = result.answers;
  const hasAnswers = answers && typeof answers === 'object' && Object.keys(answers).length > 0;
  const hasScore = Number(result.score || 0) > 0;
  const hasSubmissionTimestamp = Boolean(result.submittedAt);
  const isTeacherEvaluated = Boolean(result.evaluatedAt || (result.evaluatedBy && result.evaluatedBy !== 'Automated AI Proctor Security'));

  // If it has 0 marks, no answers, and no submission timestamp or evaluation, it cannot be a completed exam
  if (!hasAnswers && !hasScore && !hasSubmissionTimestamp && !isTeacherEvaluated) {
    return false;
  }

  return true;
};

export const deduplicateExamsList = (examList) => {
  if (!Array.isArray(examList)) return [];
  const map = new Map();
  for (const ex of examList) {
    if (!ex) continue;
    const titleKey = String(ex.title || ex.examTitle || 'Theory Assessment').trim().toLowerCase();
    const subjKey = String(ex.subject || 'General').trim().toLowerCase();
    const targetKey = String(ex.targetStudentEmail || (Array.isArray(ex.assignedStudents) ? ex.assignedStudents.join(',') : '')).trim().toLowerCase();
    const semKey = `${titleKey}::${subjKey}::${targetKey}`;

    if (!map.has(semKey)) {
      map.set(semKey, ex);
    } else {
      const prev = map.get(semKey);
      const prevQs = Array.isArray(prev.questions) ? prev.questions.length : 0;
      const curQs = Array.isArray(ex.questions) ? ex.questions.length : 0;
      const hasMongoId = ex._id && !String(ex._id).startsWith('exam-') && !String(ex._id).startsWith('mem-') && !String(ex._id).startsWith('teacher-');
      if (curQs >= prevQs || hasMongoId) {
        map.set(semKey, { ...prev, ...ex });
      }
    }
  }
  return Array.from(map.values());
};

export const isTeacherPublishedOralViva = (v) => {
  if (!v || !v.title) return false;
  if (v.id === 1 || v.id === 2 || v.id === 'viva-cs-1' || v.id === 'viva-cs-2') return false;
  const titleStr = String(v.title || '').toLowerCase();
  if (titleStr.includes('operating systems & process management')) return false;
  if (titleStr.includes('computer science & operating systems oral viva')) return false;
  return Boolean(v.teacherEmail || v.creatorEmail || (String(v.id || '').startsWith('viva_') && v.status === 'Active'));
};

export default function StudentDashboard() {
  const navigate = useNavigate();
  const [studentProfile, setStudentProfile] = useState(readStudentProfile);

  // Strict portal role verification
  useEffect(() => {
    try {
      const session = JSON.parse(localStorage.getItem('auth_session') || '{}');
      const sessionRole = (session.role || '').toLowerCase();
      if (sessionRole && sessionRole !== 'student') {
        speakIn(`Access restricted. You are logged in as a ${sessionRole.toUpperCase()}, not a student. Redirecting to your dashboard.`, 'en-US');
        if (sessionRole === 'teacher') navigate('/teacher-dashboard');
        else if (sessionRole === 'admin') navigate('/admin-dashboard');
        else navigate('/student-login');
      }
    } catch (e) {}
  }, [navigate]);

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileEditForm, setProfileEditForm] = useState(readStudentProfile);
  const student = studentProfile;

  const [interestedSubjectsList, setInterestedSubjectsList] = useState(() => {
    try {
      const session = JSON.parse(localStorage.getItem('auth_session') || '{}');
      const email = (session.email || '').trim().toLowerCase();
      const stored = localStorage.getItem(`student_interested_subjects_${email}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    const initialSub = studentProfile.interestedSubject || studentProfile.subject || 'Computer Science';
    return [initialSub];
  });

  const handleProfilePicUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const picUrl = ev.target.result;
        const updated = { ...studentProfile, profilePic: picUrl };
        setStudentProfile(updated);
        setProfileEditForm(updated);
        try {
          localStorage.setItem('student_profile_pic', picUrl);
          localStorage.setItem('last_active_student_profile_pic', picUrl);
          const session = JSON.parse(localStorage.getItem('auth_session') || '{}');
          session.profilePic = picUrl;
          localStorage.setItem('auth_session', JSON.stringify(session));
          const cleanEmail = (session.email || updated.email || '').trim().toLowerCase();
          if (cleanEmail) {
            const allProfiles = JSON.parse(localStorage.getItem('student_profiles_by_email') || '{}');
            allProfiles[cleanEmail] = { ...(allProfiles[cleanEmail] || {}), ...updated, profilePic: picUrl };
            localStorage.setItem('student_profiles_by_email', JSON.stringify(allProfiles));
          }
          window.dispatchEvent(new Event('storage'));
        } catch (err) {}

        const vec = await extractBiometricFeaturesFromImage(picUrl);
        if (vec) enrolledFaceVectorRef.current = vec;

        announce("Profile picture updated successfully!");
        speakText("Profile picture updated successfully.");
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = () => {
    const updated = { ...profileEditForm, studentId: profileEditForm.registerNumber };
    delete updated.course;
    setStudentProfile(updated);
    setIsEditingProfile(false);
    if (updated.interestedSubject && updated.interestedSubject !== activeSubject) {
      handleSwitchStudentSubject(updated.interestedSubject);
    }
    try {
      const session = JSON.parse(localStorage.getItem('auth_session') || '{}');
      const cleanEmail = (session.email || updated.email || '').trim().toLowerCase();
      if (cleanEmail) {
        const allProfiles = JSON.parse(localStorage.getItem('student_profiles_by_email') || '{}');
        allProfiles[cleanEmail] = { ...(allProfiles[cleanEmail] || {}), ...updated };
        delete allProfiles[cleanEmail].course;
        localStorage.setItem('student_profiles_by_email', JSON.stringify(allProfiles));
      }
    } catch (err) {}
    const msg = `Student profile saved successfully for ${updated.name}. Register number: ${updated.registerNumber}. Focused Subject: ${updated.interestedSubject || activeSubject}.`;
    announce(msg);
    speakText(msg);
  };

  const handleReadProfileAloud = () => {
    const speechText = `Student Profile overview for ${studentProfile.name}. ` +
      `Register Number: ${studentProfile.registerNumber}. ` +
      `Full Name: ${studentProfile.name}. ` +
      `Email Address: ${studentProfile.email}. ` +
      `Focused Main Subject: ${studentProfile.interestedSubject || activeSubject}.`;

    announce(`🔊 Narrating Profile for ${studentProfile.name}`);
    speakText(speechText);
  };

  // --- STEP-BY-STEP VOICE ASSISTANT PROFILE WIZARD ---
  const [isVoiceProfileWizardOpen, setIsVoiceProfileWizardOpen] = useState(false);
  const [voiceProfileStep, setVoiceProfileStep] = useState(1); // 1: Name, 2: Main Subject
  const [wizardTranscript, setWizardTranscript] = useState('');
  const [isWizardListening, setIsWizardListening] = useState(false);
  const [wizardFormData, setWizardFormData] = useState({
    name: '',
    subject: 'Computer Science'
  });
  const wizardRecognitionRef = useRef(null);
  const wizardSilenceTimeoutRef = useRef(null);
  const wizardStepRef = useRef(1);
  const wizardFormRef = useRef({ name: '', subject: 'Computer Science' });

  const stopWizardListening = () => {
    if (wizardSilenceTimeoutRef.current) {
      clearTimeout(wizardSilenceTimeoutRef.current);
      wizardSilenceTimeoutRef.current = null;
    }
    if (wizardRecognitionRef.current) {
      try {
        wizardRecognitionRef.current.onresult = null;
        wizardRecognitionRef.current.onerror = null;
        wizardRecognitionRef.current.onend = null;
        wizardRecognitionRef.current.abort();
      } catch (e) {}
      wizardRecognitionRef.current = null;
    }
    setIsWizardListening(false);
  };

  const startWizardListening = (targetStep = null) => {
    stopWizardListening();
    const currentStep = targetStep || wizardStepRef.current;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      announce("Speech recognition is not supported in this browser.");
      return;
    }

    try {
      const rec = new SpeechRecognition();
      wizardRecognitionRef.current = rec;
      rec.lang = 'en-IN';
      rec.continuous = true;
      rec.interimResults = true;

      rec.onstart = () => {
        setIsWizardListening(true);
      };

      rec.onresult = (e) => {
        let transcript = '';
        for (let i = 0; i < e.results.length; i++) {
          transcript += e.results[i][0].transcript;
        }
        const cleaned = transcript.trim();
        setWizardTranscript(cleaned);

        if (wizardSilenceTimeoutRef.current) {
          clearTimeout(wizardSilenceTimeoutRef.current);
        }

        const lower = cleaned.toLowerCase();
        if (lower === 'cancel' || lower === 'close' || lower === 'exit') {
          closeVoiceProfileWizard();
          return;
        }
        if (lower === 'repeat' || lower === 'say again') {
          stopWizardListening();
          speakWizardStepPrompt(currentStep);
          return;
        }
        if (lower === 'skip' || lower === 'next') {
          stopWizardListening();
          handleWizardNextStep();
          return;
        }

        wizardSilenceTimeoutRef.current = setTimeout(() => {
          stopWizardListening();
          processWizardInputForStep(currentStep, cleaned);
        }, 1600);
      };

      rec.onerror = (e) => {
        console.warn("Wizard speech recognition error:", e);
        setIsWizardListening(false);
      };

      rec.onend = () => {
        setIsWizardListening(false);
      };

      rec.start();
      setIsWizardListening(true);
    } catch (err) {
      console.warn("Failed to start wizard speech recognition:", err);
      setIsWizardListening(false);
    }
  };

  const speakWizardStepPrompt = (step) => {
    cancelSpeech();
    stopWizardListening();
    let prompt = "";
    if (step === 1) {
      prompt = "Step 1 of 2: What is your full name? Please speak your full name now.";
    } else if (step === 2) {
      prompt = "Step 2 of 2: What is your focused main subject? You can say Computer Science, Mathematics, Physics, Chemistry, Biology, Commerce, Social Science, or Engineering.";
    }
    announce(prompt);
    speakText(prompt, () => {
      startWizardListening(step);
    });
  };

  const processWizardInputForStep = (step, rawInput) => {
    if (!rawInput) {
      speakText("I didn't hear anything. Please try speaking again.", () => {
        startWizardListening(step);
      });
      return;
    }

    const trimmed = rawInput.trim();
    if (step === 1) {
      let formattedName = trimmed
        .replace(/^(my name is|i am|name is|this is|call me)\s+/i, '')
        .replace(/\b\w/g, c => c.toUpperCase());
      if (!formattedName) formattedName = trimmed;
      const updated = { ...wizardFormRef.current, name: formattedName };
      wizardFormRef.current = updated;
      setWizardFormData(updated);
      setWizardTranscript('');

      speakText(`Thank you, I got your name as ${formattedName}. Moving to Step 2.`, () => {
        wizardStepRef.current = 2;
        setVoiceProfileStep(2);
        speakWizardStepPrompt(2);
      });
    } else if (step === 2) {
      const matchedMain = findMainSubject(trimmed);
      if (matchedMain) {
        const updated = { ...wizardFormRef.current, subject: matchedMain };
        wizardFormRef.current = updated;
        setWizardFormData(updated);
        setWizardTranscript('');

        speakText(`Selected main subject as ${matchedMain}. All steps are complete! Saving your profile now.`, () => {
          saveWizardProfile(updated);
        });
      } else {
        speakText(`I couldn't identify that as a main subject. Please choose from: Computer Science, Mathematics, Physics, Chemistry, Biology, Commerce, Social Science, or Engineering.`, () => {
          startWizardListening(2);
        });
      }
    }
  };

  const saveWizardProfile = (formDataToSave) => {
    stopWizardListening();
    cancelSpeech();
    const data = formDataToSave || wizardFormRef.current;
    const finalName = data.name || studentProfile.name || 'Student';
    const finalSubject = data.subject || activeSubject || 'Computer Science';

    const updatedProfile = {
      ...studentProfile,
      name: finalName,
      subject: finalSubject,
      interestedSubject: finalSubject,
      studentId: studentProfile.registerNumber
    };
    delete updatedProfile.course;
    delete updatedProfile.dob;

    setStudentProfile(updatedProfile);
    setProfileEditForm(updatedProfile);

    handleSwitchStudentSubject(finalSubject);

    try {
      const session = JSON.parse(localStorage.getItem('auth_session') || '{}');
      const cleanEmail = (session.email || updatedProfile.email || '').trim().toLowerCase();
      if (cleanEmail) {
        const allProfiles = JSON.parse(localStorage.getItem('student_profiles_by_email') || '{}');
        allProfiles[cleanEmail] = { ...(allProfiles[cleanEmail] || {}), ...updatedProfile };
        delete allProfiles[cleanEmail].course;
        delete allProfiles[cleanEmail].dob;
        localStorage.setItem('student_profiles_by_email', JSON.stringify(allProfiles));
      }
    } catch (err) {}

    setIsVoiceProfileWizardOpen(false);
    const msg = `Profile successfully updated by Voice Assistant for ${finalName}. Main subject: ${finalSubject}.`;
    announce(msg);
    speakText(msg);
  };

  const startVoiceProfileWizard = () => {
    if (isVoiceListeningRef.current) {
      closeVoiceAssistant(false);
    }
    cancelSpeech();
    const initialForm = {
      name: studentProfile.name || '',
      subject: activeSubject || 'Computer Science'
    };
    wizardFormRef.current = initialForm;
    wizardStepRef.current = 1;
    setWizardFormData(initialForm);
    setVoiceProfileStep(1);
    setWizardTranscript('');
    setIsVoiceProfileWizardOpen(true);

    setTimeout(() => {
      speakWizardStepPrompt(1);
    }, 400);
  };

  const closeVoiceProfileWizard = () => {
    stopWizardListening();
    cancelSpeech();
    setIsVoiceProfileWizardOpen(false);
    speakText("Voice profile assistant closed.");
  };

  const handleWizardNextStep = () => {
    stopWizardListening();
    cancelSpeech();
    if (voiceProfileStep === 1) {
      wizardStepRef.current = 2;
      setVoiceProfileStep(2);
      speakWizardStepPrompt(2);
    } else {
      saveWizardProfile();
    }
  };

  const handleWizardPrevStep = () => {
    stopWizardListening();
    cancelSpeech();
    if (voiceProfileStep === 2) {
      wizardStepRef.current = 1;
      setVoiceProfileStep(1);
      speakWizardStepPrompt(1);
    }
  };

  const [activeTab, setActiveTab] = useState('Dashboard');
  const [activeSubject, setActiveSubject] = useState(() => {
    const prof = readStudentProfile();
    return prof.interestedSubject || prof.subject || 'Computer Science';
  });

  // Keep activeSubject strictly synced with teacher assignments and storage
  useEffect(() => {
    const syncSubjectFromStorage = () => {
      const currentEmail = (studentProfile.email || '').trim().toLowerCase();
      if (!currentEmail) return;
      const sharedSubjects = JSON.parse(localStorage.getItem('shared_student_subjects') || '{}');
      const assigned = sharedSubjects[currentEmail];
      if (assigned && assigned !== activeSubject) {
        setActiveSubject(assigned);
        setStudentProfile(prev => ({ ...prev, interestedSubject: assigned, subject: assigned }));
        announce(`📢 Teacher updated your subject preference to ${assigned}.`);
        speakText(`Your teacher assigned ${assigned} as your focused academic subject. Dashboard updated.`);
      }
    };

    window.addEventListener('storage', syncSubjectFromStorage);
    const interval = setInterval(syncSubjectFromStorage, 2500);
    return () => {
      window.removeEventListener('storage', syncSubjectFromStorage);
      clearInterval(interval);
    };
  }, [activeSubject, studentProfile.email]);

  const handleSwitchStudentSubject = async (newSubject) => {
    // Strictly prevent subject switching when student is in an exam or oral viva
    if (isExamActive || currentExam || activeTab === 'AI Exam Assistant' || activeTab === 'Active Exam') {
      console.warn("Ignoring subject switch during an active exam session.");
      return;
    }
    if (activeTab === 'AI Oral Viva Simulator') {
      console.warn("Ignoring subject switch during an active viva session.");
      return;
    }

    const targetSub = (newSubject || 'Computer Science').trim();
    setActiveSubject(targetSub);
    setStudentProfile(prev => ({ ...prev, interestedSubject: targetSub, subject: targetSub }));
    setProfileEditForm(prev => ({ ...prev, interestedSubject: targetSub, subject: targetSub }));

    setInterestedSubjectsList(prev => {
      const updated = prev.includes(targetSub) ? prev : [...prev, targetSub];
      try {
        const session = JSON.parse(localStorage.getItem('auth_session') || '{}');
        const email = (session.email || '').trim().toLowerCase();
        if (email) localStorage.setItem(`student_interested_subjects_${email}`, JSON.stringify(updated));
      } catch (err) {}
      return updated;
    });

    const currentEmail = (studentProfile.email || '').trim().toLowerCase();
    if (currentEmail) {
      await updateStudentSubject(currentEmail, targetSub);
    }

    const msg = `Your interested subject has been changed to ${targetSub}. Dashboard is now focused on ${targetSub}.`;
    announce(`🎓 ${msg}`);
    speakText(msg);
  };

  const [exams, setExams] = useState(initialExams);
  const [results, setResults] = useState(() => {
    try {
      const profile = readStudentProfile();
      const currentEmail = (profile.email || '').toLowerCase().trim();
      const currentName = (profile.name || '').toLowerCase().trim();
      const rawCompleted = localStorage.getItem('student_completed_results');
      const rawShared = localStorage.getItem('shared_student_results');
      const userCompleted = rawCompleted ? JSON.parse(rawCompleted) : [];
      const sharedForStudent = rawShared ? JSON.parse(rawShared) : [];
      const combined = [...(Array.isArray(userCompleted) ? userCompleted : []), ...(Array.isArray(sharedForStudent) ? sharedForStudent : [])];

      const matchesStudent = (r) => {
        if (!r) return false;
        const rEmail = (r.studentEmail || r.email || '').toLowerCase().trim();
        const rName = (r.student || r.studentName || '').toLowerCase().trim();
        if (currentEmail && rEmail && currentEmail === rEmail) return true;
        if (currentName && currentName !== 'student' && rName && (currentName === rName || rName.includes(currentName) || currentName.includes(rName))) return true;
        if (rEmail === 'student@school.edu' || rEmail === 'student@blindassist.edu' || !rEmail) return true;
        return true;
      };

      const map = new Map();
      combined.filter(r => isExamSuccessfullyCompleted(r) && matchesStudent(r)).forEach(r => {
        map.set(String(r.id || r.examName), r);
      });
      return Array.from(map.values());
    } catch {
      return [];
    }
  });
  const [studentResultsFilter, setStudentResultsFilter] = useState('all'); // 'all' | 'written' | 'viva'
  const [announcements, setAnnouncements] = useState(() => {
    try {
      const raw = localStorage.getItem('shared_notifications');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const sEmail = (studentProfile.email || '').toLowerCase().trim();
          const sName = (studentProfile.name || '').toLowerCase().trim();
          return parsed.filter(n => isNotificationForStudent(n, sEmail, sName));
        }
      }
    } catch (e) {}
    return [];
  });
  const seenNotifIdsRef = React.useRef(new Set());

  // Active Exam state
  const [currentExam, setCurrentExam] = useState(null);
  const [isExamActive, setIsExamActive] = useState(false);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [studentAnswers, setStudentAnswers] = useState({});
  const [currentAnswerInput, setCurrentAnswerInput] = useState('');
  const [examSubmitted, setExamSubmitted] = useState(false);
  const [examTimeRemaining, setExamTimeRemaining] = useState(5400); // 90 minutes in seconds

  // Voice Assistant Master State (Enable / Disable)
  const [isVoiceAssistantEnabled, setIsVoiceAssistantEnabled] = useState(() => !isVoiceDisabled());

  // Listen to global voice enable / disable state changes across tabs or pages
  useEffect(() => {
    const handleVoiceSync = () => {
      const disabled = isVoiceDisabled();
      setIsVoiceAssistantEnabled(!disabled);
      if (disabled) {
        cancelSpeech();
        if (activeVoiceRecognitionRef.current) {
          try { activeVoiceRecognitionRef.current.abort(); } catch (e) {}
          activeVoiceRecognitionRef.current = null;
        }
        if (examAnswerRecognitionRef.current) {
          try { examAnswerRecognitionRef.current.abort(); } catch (e) {}
          examAnswerRecognitionRef.current = null;
        }
        if (vivaRecognitionRef.current) {
          try { vivaRecognitionRef.current.abort(); } catch (e) {}
          vivaRecognitionRef.current = null;
        }
        setIsDictatingExamAnswer(false);
        setIsVoiceListening(false);
        isVoiceListeningRef.current = false;
        voiceAssistantIsClosingRef.current = true;
        setIsVoiceAssistantModalOpen(false);
      }
    };
    window.addEventListener('voice_state_changed', handleVoiceSync);
    window.addEventListener('storage', handleVoiceSync);
    return () => {
      window.removeEventListener('voice_state_changed', handleVoiceSync);
      window.removeEventListener('storage', handleVoiceSync);
    };
  }, []);

  // Voice Assistant Global Modal state
  const [isVoiceListening, setIsVoiceListening] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState('');
  const [liveVoiceTranscript, setLiveVoiceTranscript] = useState('');
  const [manualVoiceInput, setManualVoiceInput] = useState('');
  const [typedCommandInput, setTypedCommandInput] = useState('');

  const handleLogout = () => {
    cancelSpeech();
    speakText("Logging out of Student Dashboard. Redirecting to login.");
    try {
      const session = JSON.parse(localStorage.getItem('auth_session') || '{}');
      if (session.email) {
        const loggedMap = JSON.parse(localStorage.getItem('logged_in_users') || '{}');
        const cleanE = session.email.toLowerCase().trim();
        if (loggedMap[cleanE]) {
          loggedMap[cleanE].status = 'offline';
          loggedMap[cleanE].lastLogout = new Date().toISOString();
          localStorage.setItem('logged_in_users', JSON.stringify(loggedMap));
        }
      }
      localStorage.removeItem('auth_session');
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      localStorage.removeItem('role');
      localStorage.removeItem('draft_teacher_exam');
      localStorage.removeItem('draft_teacher_selected_qids');
      sessionStorage.clear();
    } catch (e) {}
    setTimeout(() => {
      navigate('/student-login');
    }, 800);
  };

  const handleExecuteTypedCommand = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const cleanCmd = (typedCommandInput || '').trim();
    if (!cleanCmd) return;
    setTypedCommandInput('');
    executeCommand(cleanCmd);
  };

  // Inline Exam Answer Voice Dictation State
  const [isDictatingExamAnswer, setIsDictatingExamAnswer] = useState(false);
  const [liveExamAnswerTranscript, setLiveExamAnswerTranscript] = useState('');
  const examAnswerRecognitionRef = useRef(null);
  const examAnswerSilenceTimerRef = useRef(null);

  const isVoiceListeningRef = useRef(false);
  const activeVoiceRecognitionRef = useRef(null);
  const voiceFallbackTimeoutRef = useRef(null);
  const voiceAssistantIsClosingRef = useRef(false);
  const voiceSilenceTimerRef = useRef(null);

  useEffect(() => {
    isVoiceListeningRef.current = isVoiceListening;
  }, [isVoiceListening]);

  // Accessibility Preferences
  const [accessibility, setAccessibility] = useState({
    ttsEnabled: true,
    sttEnabled: true,
    speechRate: 0.85,
    speechPitch: 1.0,
    speechVolume: 1.0,
    ttsVoice: '',
    fontSize: 'normal',
    highContrast: false,
    keyboardNav: true,
    reducedVisual: false
  });

  const [builtinVoices, setBuiltinVoices] = useState([]);
  useEffect(() => {
    const v = getBuiltinVoices();
    if (v && v.length > 0) setBuiltinVoices(v);
  }, []);

  // Helper: Enforce that Study Material questions are strictly Short answer or Long answer (NO MCQ)
  const sanitizeStudyMaterialList = (list) => {
    if (!Array.isArray(list)) return [];
    return list.map(mat => {
      if (!mat) return mat;
      const questions = (mat.questions || []).map(q => {
        if (!q) return q;
        const isLong = (q.type && (q.type.toLowerCase().includes('long') || q.type.toLowerCase().includes('descriptive') || q.type.toLowerCase().includes('essay'))) || (q.marks && q.marks >= 4) || (q.text && /explain|describe|differentiate|compare|discuss|list and explain|how does|why does/i.test(q.text));
        const cleanType = isLong ? 'Long answer' : 'Short answer';
        let cleanText = q.text || '';
        if (/^True or False:\s*/i.test(cleanText)) {
          cleanText = cleanText.replace(/^True or False:\s*/i, '');
          if (!cleanText.endsWith('?')) cleanText += '?';
          cleanText = 'Explain: ' + cleanText;
        }
        return {
          ...q,
          type: cleanType,
          text: cleanText,
          options: [], // Strictly NO MCQ options in Study Material!
          marks: isLong ? 5 : 2,
          oneLineAnswer: q.oneLineAnswer || q.correctAnswer || q.answer || mat.practiceAnswer || mat.oneLineAnswer || '',
          correctAnswer: q.correctAnswer || q.oneLineAnswer || q.answer || ''
        };
      });
      return {
        ...mat,
        questions: questions
      };
    });
  };
  // Study Test Submissions & Teacher Evaluations Store
  const [studyTestResultsList, setStudyTestResultsList] = useState(() => {
    try {
      const raw = localStorage.getItem('shared_study_test_results');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  // Study Materials state (Strictly Short Answer or Long Answer, NO MCQ)
  const defaultStudyMaterials = [];

  const [studyMaterials, setStudyMaterials] = useState(() => {
    try {
      const saved = localStorage.getItem('shared_study_materials');
      if (saved) {
        const parsed = JSON.parse(saved);
        const filtered = parsed.filter(m => 
          !(m.id === 1 && m.title === 'Physics: Motion & Laws of Force') && 
          !(m.id === 2 && m.title === 'Computer Networks: OSI Model & Protocols') && 
          !(m.id === 3 && m.title === 'Mathematics: Algebra & Equations') &&
          !(m.id === 1 && m.title === 'Computer Networks OSI Layer Guide (PDF)') &&
          !(m.id === 2 && m.title === 'OS Deadlocks Audio Lecture & Voice Notes') &&
          !(m.id === 3 && m.title === 'Cyber Security Phishing Defense Book')
        );
        const cleaned = sanitizeStudyMaterialList(filtered);
        localStorage.setItem('shared_study_materials', JSON.stringify(cleaned));
        return cleaned;
      }
      return [];
    } catch {
      return [];
    }
  });
  const [activePracticeMat, setActivePracticeMat] = useState(null);
  const [practiceQIdx, setPracticeQIdx] = useState(0);
  const [practiceAnswerInput, setPracticeAnswerInput] = useState('');
  const [practiceFeedback, setPracticeFeedback] = useState(null);
  const [practiceAnswersByQ, setPracticeAnswersByQ] = useState({});
  const [practiceSubmittedMap, setPracticeSubmittedMap] = useState({});
  const [studyQuery, setStudyQuery] = useState('');
  const [aiStudyResponse, setAiStudyResponse] = useState('');

  // Voice Broadcasts State
  const [broadcasts, setBroadcasts] = useState(() => {
    try {
      const raw = localStorage.getItem('shared_voice_broadcasts');
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });

  // Audio Bookmarks & AI Summarizer State (Features 2 & 5)
  const [audioBookmarks, setAudioBookmarks] = useState(() => {
    try {
      const saved = localStorage.getItem('audio_bookmarks');
      if (saved) {
        const parsed = JSON.parse(saved);
        const filtered = parsed.filter(b => 
          !(b.id === 1 && b.title === 'Physics: Motion & Laws of Force') && 
          !(b.id === 2 && b.title === 'Computer Networks: OSI Model & Protocols')
        );
        if (parsed.length !== filtered.length) {
          localStorage.setItem('audio_bookmarks', JSON.stringify(filtered));
        }
        return filtered;
      }
      return [];
    } catch {
      return [];
    }
  });
  const [aiConceptSummary, setAiConceptSummary] = useState('');
  const [selectedMcqChoice, setSelectedMcqChoice] = useState('');
  const [mcqConfirmationPending, setMcqConfirmationPending] = useState(false);

  // Study Material Lesson Test State
  const [activeLessonTest, setActiveLessonTest] = useState(null);
  const [lessonTestQIndex, setLessonTestQIndex] = useState(0);
  const [lessonTestInput, setLessonTestInput] = useState('');
  const [lessonTestAnswers, setLessonTestAnswers] = useState({});
  const [lessonTestFeedback, setLessonTestFeedback] = useState(null);

  // AI Viva Simulator & Shared Oral Vivas State (Teacher Published Only)
  const [oralVivas, setOralVivas] = useState(() => {
    try {
      const saved = localStorage.getItem('shared_oral_vivas');
      if (saved) {
        const parsed = JSON.parse(saved);
        const filtered = Array.isArray(parsed) ? parsed.filter(isTeacherPublishedOralViva) : [];
        if (filtered.length !== (parsed ? parsed.length : 0)) {
          localStorage.setItem('shared_oral_vivas', JSON.stringify(filtered));
        }
        return filtered;
      }
      return [];
    } catch { return []; }
  });
  const [vivaSubject, setVivaSubject] = useState(() => {
    try {
      const saved = localStorage.getItem('shared_oral_vivas');
      if (saved) {
        const parsed = JSON.parse(saved);
        const filtered = Array.isArray(parsed) ? parsed.filter(isTeacherPublishedOralViva) : [];
        if (filtered.length > 0) return filtered[0].title || filtered[0].subject || '';
      }
    } catch (e) {}
    return '';
  });
  const [vivaQIndex, setVivaQIndex] = useState(0);
  const [vivaAnswerInput, setVivaAnswerInput] = useState('');
  const [vivaFeedback, setVivaFeedback] = useState(null);
  const [vivaAnswersRecord, setVivaAnswersRecord] = useState({});
  const [isVivaDictating, setIsVivaDictating] = useState(false);
  const [isVivaSubmitted, setIsVivaSubmitted] = useState(false);
  const [vivaOverallResult, setVivaOverallResult] = useState(null);
  const [vivaSubmissionsList, setVivaSubmissionsList] = useState(() => {
    try {
      const raw = localStorage.getItem('shared_viva_submissions');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const isVivaDictatingRef = useRef(false);
  const vivaRecognitionRef = useRef(null);
  const lastSpokenVivaAnswerRef = useRef('');

  // Filtered Subject Collections: Strict full-dashboard isolation by activeSubject
  const filteredExams = useMemo(() => {
    const studentEmail = (student.email || studentProfile.email || '').toLowerCase().trim();
    const studentName = (student.name || studentProfile.name || '').toLowerCase().trim();

    const matching = (exams || []).filter(ex => {
      // 1. Is this exam assigned to this student?
      if (!isExamAssignedToStudent(ex, studentEmail, studentName)) {
        return false;
      }

      // 2. If this exam is explicitly personalized for this student, ALWAYS show it!
      const isTargetedToMe = Boolean(
        (ex.targetStudentEmail && studentEmail && ex.targetStudentEmail.toLowerCase().trim() === studentEmail) ||
        (ex.targetStudentName && studentName && (
          ex.targetStudentName.toLowerCase().trim() === studentName ||
          studentName.includes(ex.targetStudentName.toLowerCase().trim()) ||
          ex.targetStudentName.toLowerCase().trim().includes(studentName)
        )) ||
        (studentName && studentName.length > 2 && String(ex.title || '').toLowerCase().includes(studentName))
      );
      if (isTargetedToMe) {
        return true;
      }

      // 3. Filter general exams by activeSubject
      return isSubjectMatching(ex.subject, activeSubject);
    });

    // Strictly ensure each published exam shows only ONCE in the table & dashboard
    const uniqueMap = new Map();
    for (const ex of matching) {
      const titleKey = String(ex.title || ex.examTitle || 'Exam').trim().toLowerCase();
      const subjKey = String(ex.subject || 'General').trim().toLowerCase();
      const targetKey = String(ex.targetStudentEmail || '').trim().toLowerCase();
      const key = `${titleKey}::${subjKey}::${targetKey}`;

      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, ex);
      } else {
        const prev = uniqueMap.get(key);
        const prevQs = Array.isArray(prev.questions) ? prev.questions.length : 0;
        const curQs = Array.isArray(ex.questions) ? ex.questions.length : 0;
        if (curQs > prevQs || (ex.targetStudentEmail && !prev.targetStudentEmail)) {
          uniqueMap.set(key, ex);
        }
      }
    }

    return Array.from(uniqueMap.values());
  }, [exams, activeSubject, student.email, studentProfile.email, student.name, studentProfile.name]);

  const filteredStudyMaterials = useMemo(() => {
    const matching = (studyMaterials || []).filter(m => isSubjectMatching(m.subject, activeSubject));
    if (matching.length > 0) return matching;
    const preset = getSubjectDataBank(activeSubject);
    return preset?.studyMaterials || [];
  }, [studyMaterials, activeSubject]);

  const filteredOralVivas = useMemo(() => {
    const studentEmail = (student.email || studentProfile.email || '').toLowerCase().trim();
    const studentName = (student.name || studentProfile.name || '').toLowerCase().trim();

    const matching = (Array.isArray(oralVivas) ? oralVivas : []).filter(v => {
      if (!isTeacherPublishedOralViva(v)) return false;
      if (!isSubjectMatching(v.subject || v.title, activeSubject)) return false;
      
      const targetEmail = String(v.targetStudentEmail || '').toLowerCase().trim();
      const targetName = String(v.targetStudentName || '').toLowerCase().trim();
      if (targetEmail && targetEmail !== 'all' && targetEmail !== studentEmail && (!targetName || targetName !== studentName)) {
        return false;
      }
      return true;
    });

    // Strictly return only teacher-published matching vivas; if none, return empty array!
    return matching;
  }, [oralVivas, activeSubject, student.email, studentProfile.email, student.name, studentProfile.name]);

  const filteredResults = useMemo(() => {
    return (results || []).filter(r => isSubjectMatching(r.subject, activeSubject) && isExamSuccessfullyCompleted(r));
  }, [results, activeSubject]);

  const studentVivaResults = useMemo(() => {
    const sEmail = (student.email || studentProfile.email || '').toLowerCase().trim();
    const sName = (student.name || studentProfile.name || '').toLowerCase().trim();
    return (vivaSubmissionsList || []).filter(s => {
      if (!s) return false;
      const matchSub = !activeSubject || isSubjectMatching(s.subject, activeSubject);
      if (!matchSub) return false;
      const subEmail = String(s.studentEmail || '').toLowerCase().trim();
      const subName = String(s.studentName || s.student || '').toLowerCase().trim();
      if (sEmail && subEmail && sEmail === subEmail) return true;
      if (sName && subName && (sName === subName || subName.includes(sName) || sName.includes(subName))) return true;
      if (!subEmail || subEmail === 'student@school.edu' || subEmail === 'student@blindassist.edu') return true;
      return true;
    });
  }, [vivaSubmissionsList, activeSubject, student.email, studentProfile.email, student.name, studentProfile.name]);

  useEffect(() => {
    if (filteredOralVivas && filteredOralVivas.length > 0) {
      const currentValid = filteredOralVivas.some(v => v.title === vivaSubject || v.subject === vivaSubject || String(v.id) === vivaSubject);
      if (!currentValid) {
        setVivaSubject(filteredOralVivas[0].title || filteredOralVivas[0].subject || '');
        setVivaQIndex(0);
        setVivaFeedback(null);
        setVivaAnswerInput('');
      }
    } else {
      setVivaSubject('');
    }
  }, [filteredOralVivas, vivaSubject]);

  // Sync Student's Viva Submissions & Teacher Evaluations
  useEffect(() => {
    const studentEmail = (student.email || studentProfile.email || '').toLowerCase().trim();
    if (!studentEmail || !Array.isArray(vivaSubmissionsList) || vivaSubmissionsList.length === 0) {
      return;
    }

    const matched = vivaSubmissionsList.find(s => {
      if (!s) return false;
      const sEmail = String(s.studentEmail || '').toLowerCase().trim();
      if (sEmail !== studentEmail) return false;
      const matchTopic = vivaSubject && (s.vivaTitle === vivaSubject || s.vivaId === vivaSubject);
      const matchSubject = activeSubject && isSubjectMatching(s.subject, activeSubject);
      return matchTopic || matchSubject;
    });

    if (matched) {
      setVivaOverallResult(prev => {
        if (prev && prev.status === 'Pending Teacher Evaluation' && matched.status === 'Evaluated') {
          speakText(`Your oral viva for ${matched.subject || activeSubject} has been evaluated by your teacher! You received a score of ${matched.teacherScore} out of 10. Teacher feedback: ${matched.teacherFeedback || 'Good job'}.`);
        }
        return matched;
      });
      setIsVivaSubmitted(true);
    }
  }, [vivaSubmissionsList, vivaSubject, activeSubject, student.email, studentProfile.email]);

  // Mandatory AI Face Verification & Proctoring State (Compulsory Face Detection & Start-to-End Proctoring)
  const [faceAuthModalOpen, setFaceAuthModalOpen] = useState(false);
  const [cameraClarityBoost, setCameraClarityBoost] = useState(true);
  const [cameraLightingFeedback, setCameraLightingFeedback] = useState('good');
  const [isElevenLabsModalOpen, setIsElevenLabsModalOpen] = useState(false);
  const [isHeaderSubDropdownOpen, setIsHeaderSubDropdownOpen] = useState(false);
  const [isBannerSubDropdownOpen, setIsBannerSubDropdownOpen] = useState(false);
  const headerSubjectDropdownRef = useRef(null);
  const bannerSubjectDropdownRef = useRef(null);

  // Click outside to close custom subject dropdowns
  useEffect(() => {
    const handleOutsideSubjectClick = (e) => {
      if (headerSubjectDropdownRef.current && !headerSubjectDropdownRef.current.contains(e.target)) {
        setIsHeaderSubDropdownOpen(false);
      }
      if (bannerSubjectDropdownRef.current && !bannerSubjectDropdownRef.current.contains(e.target)) {
        setIsBannerSubDropdownOpen(false);
      }
    };
    if (isHeaderSubDropdownOpen || isBannerSubDropdownOpen) {
      document.addEventListener('mousedown', handleOutsideSubjectClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideSubjectClick);
    };
  }, [isHeaderSubDropdownOpen, isBannerSubDropdownOpen]);
  const [pendingExamToStart, setPendingExamToStart] = useState(null);
  const [faceDetecting, setFaceDetecting] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [faceConfidence, setFaceConfidence] = useState(0);
  const [faceMatchScore, setFaceMatchScore] = useState(0);
  const [faceMatchStatus, setFaceMatchStatus] = useState('Initializing biometric verification...');
  const [faceScanProgress, setFaceScanProgress] = useState(0);
  const [faceErrorMessage, setFaceErrorMessage] = useState('');
  const [faceSnapshotUrl, setFaceSnapshotUrl] = useState(null);
  const [isFaceVerifiedForExam, setIsFaceVerifiedForExam] = useState(false);
  const [isFacePresentInExam, setIsFacePresentInExam] = useState(true);
  const [isScannedStudentWriting, setIsScannedStudentWriting] = useState(true);
  const [isOtherPersonDetected, setIsOtherPersonDetected] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [scannedExamFaceUrl, setScannedExamFaceUrl] = useState(null);
  const [faceAbsentWarningsCount, setFaceAbsentWarningsCount] = useState(0);
  const [faceMismatchStrikeCount, setFaceMismatchStrikeCount] = useState(0);
  const faceMismatchStrikeCountRef = React.useRef(0);
  const consecutiveMismatchTicksRef = React.useRef(0);
  const lastMismatchAlertTimeRef = React.useRef(0);
  const [faceMismatchActiveAlert, setFaceMismatchActiveAlert] = useState(null);
  const [examTerminationModal, setExamTerminationModal] = useState(null);
  const [isProfileSnapModalOpen, setIsProfileSnapModalOpen] = useState(false);
  const videoRef = React.useRef(null);
  const canvasRef = React.useRef(null);
  const proctorVideoRef = React.useRef(null);
  const proctorCanvasRef = React.useRef(null);
  const snapVideoRef = React.useRef(null);
  const snapCanvasRef = React.useRef(null);
  const snapStreamRef = React.useRef(null);
  const mediaStreamRef = React.useRef(null);
  const scanIntervalRef = React.useRef(null);
  const proctorScanIntervalRef = React.useRef(null);
  const lastFaceWarningTimeRef = React.useRef(0);
  const enrolledFaceVectorRef = React.useRef(null);
  const scannedExamFaceVectorRef = React.useRef(null);
  const isScannedStudentWritingRef = React.useRef(true);

  // Multi-angle face biometric states (Center, Left, Right)
  const [faceScanStage, setFaceScanStage] = useState('center'); // 'center' | 'left' | 'right' | 'complete'
  const scanStageRef = React.useRef('center');
  const [scannedAnglesState, setScannedAnglesState] = useState({ center: false, left: false, right: false });
  const scannedAnglesStateRef = React.useRef({ center: false, left: false, right: false });
  const [scannedAnglesThumbs, setScannedAnglesThumbs] = useState({ center: null, left: null, right: null });
  const scannedExamFaceVectorsRef = React.useRef({ center: null, left: null, right: null });
  const stageStableTicksRef = React.useRef(0);

  const [detectedPeopleCount, setDetectedPeopleCount] = useState(1);
  const [isMultiplePeopleDetected, setIsMultiplePeopleDetected] = useState(false);
  const [showMultiplePeopleWarningModal, setShowMultiplePeopleWarningModal] = useState(false);
  const isMultiplePeopleDetectedRef = React.useRef(false);
  const lastMultiplePeopleWarningTimeRef = React.useRef(0);
  const consecutiveMultiplePeopleCountRef = React.useRef(0);
  const lastSpokenTimestampRef = React.useRef(0);
  const hasSpokenMountFeaturesRef = React.useRef(false);

  useEffect(() => {
    isScannedStudentWritingRef.current = isScannedStudentWriting;
  }, [isScannedStudentWriting]);

  useEffect(() => {
    isMultiplePeopleDetectedRef.current = isMultiplePeopleDetected;
  }, [isMultiplePeopleDetected]);

  const lastSpokenTextRef = React.useRef("Student Dashboard active. Tap anywhere on screen or press Spacebar to activate voice assistant.");

  const announce = (msg) => {
    setVoiceNotice(msg);
    setTimeout(() => setVoiceNotice(''), 3500);
  };

  const toggleVoiceAssistantEnabled = () => {
    const nextVal = !isVoiceAssistantEnabled;
    setIsVoiceAssistantEnabled(nextVal);
    setVoiceDisabled(!nextVal);
    try {
      localStorage.setItem('student_voice_assistant_enabled', String(nextVal));
      localStorage.setItem('voice_assistant_disabled', String(!nextVal));
    } catch (e) {}
    setAccessibility(prev => ({ ...prev, ttsEnabled: nextVal, sttEnabled: nextVal }));

    if (!nextVal) {
      cancelSpeech();
      if (activeVoiceRecognitionRef.current) {
        try { activeVoiceRecognitionRef.current.abort(); } catch (e) {}
        activeVoiceRecognitionRef.current = null;
      }
      if (examAnswerRecognitionRef.current) {
        try { examAnswerRecognitionRef.current.abort(); } catch (e) {}
        examAnswerRecognitionRef.current = null;
      }
      if (vivaRecognitionRef.current) {
        try { vivaRecognitionRef.current.abort(); } catch (e) {}
        vivaRecognitionRef.current = null;
      }
      setIsDictatingExamAnswer(false);
      setIsVoiceListening(false);
      isVoiceListeningRef.current = false;
      voiceAssistantIsClosingRef.current = true;
      setIsVoiceAssistantModalOpen(false);
      announce("🔇 Voice Assistant disabled.");
    } else {
      voiceAssistantIsClosingRef.current = false;
      announce("🔊 Voice Assistant enabled.");
      speakIn("Voice Assistant enabled.", 'en-US', { force: true });
    }
  };

  const cleanTextForSpeech = (raw) => {
    if (!raw) return '';
    return String(raw)
      .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, ' ')
      .replace(/[🚨🛡️👤📸🟢🔴⚠️✓●○🎙️💾🎯📖💡🔊🔇⚡]/g, ' ')
      .replace(/[*_#`~[\]()]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const speakText = async (text, onEndCallback = null, langOverride = null) => {
    if (!isVoiceAssistantEnabled || isVoiceDisabled() || !accessibility.ttsEnabled || !text) return;
    const cleaned = cleanTextForSpeech(text);
    if (!cleaned) return;

    // Debounce exact duplicate phrases within 1.5s
    const now = Date.now();
    if (lastSpokenTextRef.current === cleaned && (now - lastSpokenTimestampRef.current < 1500)) {
      return;
    }
    lastSpokenTextRef.current = cleaned;
    lastSpokenTimestampRef.current = now;

    // Cancel all previous speech immediately before speaking new utterance
    cancelSpeech();

    // High-fidelity speech synthesis (ElevenLabs priority with seamless browser fallback)
    return await speakIn(cleaned, 'en-US', {
      rate: accessibility.speechRate || 0.88,
      voiceId: localStorage.getItem('elevenlabs_voice_id') || '21m00Tcm4TlvDq8ikWAM',
      onEnd: onEndCallback
    });
  };

  const handleRepeatSpeech = () => {
    if (lastSpokenTextRef.current) {
      speakText(`Repeating: ${lastSpokenTextRef.current}`);
    } else {
      speakText("No previous speech to repeat.");
    }
  };

  // Feature 7: Global "Where Am I?" & Voice Help Status
  const handleWhereAmI = () => {
    let screenContext = `You are currently on the ${activeTab} screen of your VisionAssist AI Student Dashboard. `;
    screenContext += `Active student profile: ${student.name}, Student ID: ${student.studentId}. `;
    
    if (activeTab === 'Dashboard') {
      screenContext += `Available features here: Quick action links for Exams, Study Materials, Voice Assistant, and Accessibility. You have ${filteredExams.length} ${activeSubject} exams listed and overall progress of ${overallProgress} percent.`;
    } else if (activeTab === 'AI Exam Assistant' || activeTab === 'Active Exam') {
      if (currentExam) {
        screenContext += `You are taking the exam ${currentExam.title}. Question ${currentQIndex + 1} of ${currentExam.questions.length}. Time remaining: ${Math.floor(examTimeRemaining / 60)} minutes. Say Next Question, Previous Question, Read Question, or Submit Exam.`;
      } else {
        screenContext += `AI Exam Assistant is ready. Click or say Start Exam to begin your assessment.`;
      }
    } else if (activeTab === 'Study Materials') {
      screenContext += `You are viewing ${filteredStudyMaterials.length} accessible audio study materials and lessons for ${activeSubject}. You can say Listen Aloud, Ask AI Tutor, or Save Bookmark.`;
    } else if (activeTab === 'Results & Performance') {
      screenContext += `You are viewing your past exam results and grades for ${activeSubject}. Overall average score: ${overallProgress} percent. Say Read Performance Report to hear your complete summary aloud.`;
    } else {
      screenContext += `Press Spacebar or tap anywhere on the screen at any time to issue voice commands.`;
    }

    announce(screenContext);
    speakText(screenContext);
  };

  // Dedicated Results & Performances Voice Narration requested by user:
  // "opened results and performances and it should say the written exam result by the respected teacher and also viva by respected teacher"
  const speakResultsAndPerformancesReport = () => {
    let reportText = "Opened Results and Performances. ";

    // 1. Written Exam Result by Respected Teacher
    if (filteredResults.length > 0) {
      const evaluatedWritten = filteredResults.find(r => r.status === 'Corrected & Graded' || Boolean(r.evaluatedAt));
      if (evaluatedWritten) {
        const teacher = evaluatedWritten.evaluatedBy || evaluatedWritten.teacherName || 'your respected teacher';
        const pct = evaluatedWritten.percentage || Math.round(((evaluatedWritten.score || 0) / (evaluatedWritten.total || 100)) * 100);
        reportText += `Written exam result evaluated by respected teacher ${teacher}: For ${evaluatedWritten.examName}, your score is ${evaluatedWritten.score} out of ${evaluatedWritten.total}, percentage ${pct} percent. Teacher evaluation note: "${evaluatedWritten.feedback || 'Good attempt and successfully reviewed by teacher'}". `;
      } else {
        const latestWritten = filteredResults[0];
        reportText += `Written exam result for ${latestWritten.examName}: Score is ${latestWritten.score} out of ${latestWritten.total}. Awaiting grading and feedback by your respected teacher. `;
      }
      if (filteredResults.length > 1) {
        reportText += `You have completed a total of ${filteredResults.length} written exams with an overall score average of ${overallProgress} percent. `;
      }
    } else {
      reportText += `No written exam submissions found yet for ${activeSubject}. `;
    }

    // 2. Oral Viva by Respected Teacher
    if (studentVivaResults.length > 0) {
      const evaluatedViva = studentVivaResults.find(v => v.status === 'Evaluated' || (v.teacherScore !== null && v.teacherScore !== undefined));
      if (evaluatedViva) {
        const vTeacher = evaluatedViva.evaluatedBy || evaluatedViva.teacherName || 'your respected teacher';
        reportText += `Oral viva result evaluated by respected teacher ${vTeacher}: For ${evaluatedViva.vivaTitle || evaluatedViva.subject || 'viva assessment'}, your score is ${evaluatedViva.teacherScore} out of 10, grade ${evaluatedViva.gradeStatus || 'Pass'}. Respected teacher feedback: "${evaluatedViva.teacherFeedback || 'Good oral performance'}". `;
      } else {
        const latestViva = studentVivaResults[0];
        reportText += `Oral viva submission for ${latestViva.vivaTitle || latestViva.subject || 'oral viva'} has been submitted and is awaiting evaluation by your respected teacher. `;
      }
      if (studentVivaResults.length > 1) {
        reportText += `You have a total of ${studentVivaResults.length} oral viva recordings recorded. `;
      }
    } else {
      reportText += `No oral viva submissions found yet for ${activeSubject}. `;
    }

    // 3. Study Material Practice & Test Evaluations by Respected Teacher
    const studentEmailKey = (student.email || studentProfile.email || '').toLowerCase().trim();
    const evaluatedStudyResults = (studyTestResultsList || []).filter(s => 
      s && (s.studentEmail === studentEmailKey || s.studentName === student.name) && (s.evaluated || s.teacherScore !== null)
    );
    if (evaluatedStudyResults.length > 0) {
      const latestStudy = evaluatedStudyResults[0];
      const sTeacher = latestStudy.evaluatedBy || 'your respected teacher';
      const scoreVal = latestStudy.teacherScore !== null && latestStudy.teacherScore !== undefined ? latestStudy.teacherScore : latestStudy.score;
      reportText += `Study material ${latestStudy.isPractice ? 'practice' : 'test'} result evaluated by respected teacher ${sTeacher}: For ${latestStudy.materialTitle}, your score is ${scoreVal} out of 10. Teacher remarks: "${latestStudy.teacherFeedback || 'Good effort.'}". `;
    }

    announce(reportText);
    speakText(reportText);
  };

  // Feature 6: Audio Performance & Progress Report
  const handleReadPerformanceReport = () => {
    speakResultsAndPerformancesReport();
  };

  const lastAnnouncedTabRef = useRef('');
  useEffect(() => {
    if (activeTab === 'Results & Performance') {
      if (lastAnnouncedTabRef.current !== 'Results & Performance') {
        lastAnnouncedTabRef.current = 'Results & Performance';
        speakResultsAndPerformancesReport();
      }
    } else {
      lastAnnouncedTabRef.current = activeTab;
    }
  }, [activeTab]);

  // Feature 2: AI Voice Tutor Concept Summarizer
  const handleGenerateAiConceptSummary = (mat) => {
    const targetMat = mat || activePracticeMat || filteredStudyMaterials[0];
    if (!targetMat) return;
    const summaryText = `AI Concept Summary for ${targetMat.title}: ${targetMat.textContent || targetMat.detail}. Key concepts to remember: First, ${targetMat.practiceQuestion || 'core principle'}. Second, ${targetMat.practiceAnswer || 'understand practical applications.'}`;
    setAiConceptSummary(summaryText);
    announce(`AI Concept Summary generated for ${targetMat.title}`);
    speakText(summaryText);
  };

  // Feature 5: Save Audio Bookmark
  const handleSaveBookmark = (lessonTitle, snippet) => {
    const titleToSave = lessonTitle || activePracticeMat?.title || filteredStudyMaterials[0]?.title || 'Lesson Audio Note';
    const noteToSave = snippet || activePracticeMat?.textContent || 'Audio bookmark saved during lesson review.';
    const newBookmark = {
      id: Date.now(),
      title: titleToSave,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      note: noteToSave,
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    };
    const updated = [newBookmark, ...audioBookmarks];
    setAudioBookmarks(updated);
    try {
      localStorage.setItem('audio_bookmarks', JSON.stringify(updated));
    } catch (e) {}
    const msg = `Saved audio bookmark for ${newBookmark.title}. You can review it under My Audio Bookmarks.`;
    announce(msg);
    speakText(msg);
  };

  // Interactive Voice AI Question, Answer & Explanation Narrator with Voice Command Navigation
  const handleStartVoiceDictationForPractice = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { alert('Speech recognition not supported in this browser.'); return; }
    const rec = new SpeechRecognition();
    rec.lang = 'en-US';
    rec.continuous = true;
    rec.interimResults = true;

    rec.onstart = () => {
      speakText("Listening for your practice answer. Speak freely or say DONE when finished.");
    };

    rec.onresult = (e) => {
      let currentTranscript = '';
      for (let i = 0; i < e.results.length; i++) {
        currentTranscript += e.results[i][0].transcript;
      }
      const cleaned = currentTranscript.trim();
      setLiveVoiceTranscript(cleaned);
      const { isDone, cleanText } = parseDoneTrigger(cleaned);
      setPracticeAnswerInput(cleanText);

      if (isDone) {
        try { rec.stop(); } catch (err) {}
        setPracticeAnswersByQ(prev => ({ ...prev, [practiceQIdx]: cleanText }));
        announce(`✅ Recorded Answer: "${cleanText}"`);
        const promptText = `You answered: "${cleanText}". Say your command: repeat answer, or to say answer again, or next question, or repeat question, or submit.`;
        speakText(promptText);
        return;
      }
    };

    rec.onerror = () => {};
    rec.onend = () => {};

    try { rec.start(); } catch (err) {}
  };

  const listenForQuestionNavigationCommand = (currentMat, currentQuestionIdx = 0) => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.continuous = false;
      recognition.interimResults = true;

      recognition.onstart = () => {
        announce("🎙️ Voice Active: Say REPEAT, NEXT QUESTION, PREVIOUS QUESTION, or DICTATE");
      };

      recognition.onresult = (e) => {
        // Prevent speech engine self-hearing echo while TTS speaks
        if (isTTSActive()) return;

        let text = '';
        for (let i = 0; i < e.results.length; i++) {
          text += e.results[i][0].transcript;
        }
        const rawText = text.trim();
        setLiveVoiceTranscript(rawText);
        const lower = rawText.toLowerCase();

        // Immediate close check
        if (lower === 'close' || lower.includes('close assistant') || lower.includes('close overlay')) {
          try { recognition.stop(); } catch (err) {}
          speakText("Voice navigation paused.");
          return;
        }

        if (e.results[e.results.length - 1].isFinal) {
          try { recognition.stop(); } catch (err) {}

          const questionsList = (currentMat.questions && currentMat.questions.length > 0) ? currentMat.questions : [currentMat];
          const totalQ = questionsList.length;
          const isLastQ = currentQuestionIdx >= totalQ - 1;

          if (lower === 'submit' || lower.includes('submit practice') || lower.includes('say submit') || lower.includes('submit test') || lower.includes('finish practice')) {
            announce("🚀 Submitting practice answers to teacher");
            handleSubmitPracticeToTeacher();
          } else if (lower.includes('repeat question') || lower.includes('read question') || lower.includes('say repeat question') || (lower.includes('repeat') && !practiceAnswerInput)) {
            announce("🔄 Repeating Question, Answer & Explanation");
            handleSpeakQuestionAnswerExplanation(currentMat, currentQuestionIdx);
          } else if (lower.includes('repeat answer') || lower.includes('repeat my answer') || lower.includes('repeat your answer') || lower.includes('read answer')) {
            const currentAns = practiceAnswerInput || practiceAnswersByQ[currentQuestionIdx] || '';
            const promptText = `You answered: "${currentAns || 'no answer recorded'}". Say your command: repeat answer, or to say answer again, or next question, or repeat question, or submit.`;
            speakText(promptText);
          } else if (lower.includes('say your answer again') || lower.includes('say answer again') || lower.includes('your answer again') || lower.includes('clear answer') || lower.includes('change answer') || lower.includes('re-answer') || lower.includes('re-record')) {
            setPracticeAnswerInput('');
            setPracticeAnswersByQ(prev => ({ ...prev, [currentQuestionIdx]: '' }));
            speakText("Clearing previous answer. Please speak your practice answer again now. When finished, say DONE.", () => {
              setTimeout(() => handleStartVoiceDictationForPractice(), 300);
            });
          } else if (lower.includes('next question') || lower === 'next' || lower.includes('say next question') || lower.includes('forward')) {
            const nextQIdx = (currentQuestionIdx + 1) % totalQ;
            setPracticeQIdx(nextQIdx);
            setPracticeAnswerInput(practiceAnswersByQ[nextQIdx] || '');
            setPracticeFeedback(null);
            announce(`➡️ Next Question: ${nextQIdx + 1} of ${totalQ}`);
            handleSpeakQuestionAnswerExplanation(currentMat, nextQIdx);
          } else if (lower.includes('previous question') || lower === 'previous' || lower.includes('prev question') || lower.includes('back')) {
            const prevQIdx = (currentQuestionIdx - 1 + totalQ) % totalQ;
            setPracticeQIdx(prevQIdx);
            setPracticeAnswerInput(practiceAnswersByQ[prevQIdx] || '');
            setPracticeFeedback(null);
            announce(`⬅️ Previous Question: ${prevQIdx + 1} of ${totalQ}`);
            handleSpeakQuestionAnswerExplanation(currentMat, prevQIdx);
          } else if (lower.includes('dictate') || lower.includes('say your answer') || lower.includes('your answer') || lower.includes('answer') || lower.includes('speak answer') || lower.includes('start dictation')) {
            announce("🎙️ Starting Voice Dictation for your practice answer");
            handleStartVoiceDictationForPractice();
          } else {
            const guidance = isLastQ
              ? "Say repeat question, or next question, or say your answer, and say submit."
              : "Say your answer, or say repeat question, or next question, or repeat your answer.";
            speakText(guidance, () => {
              setTimeout(() => listenForQuestionNavigationCommand(currentMat, currentQuestionIdx), 400);
            });
          }
        }
      };

      recognition.onerror = () => {};
      recognition.onend = () => {};

      recognition.start();
    } catch (err) {}
  };

  const sanitizeStudyText = (rawText) => {
    if (!rawText) return '';
    const cleaned = String(rawText)
      .replace(/\/StructTreeRoot[^\n]*/gi, '')
      .replace(/\/ViewerPreferences[^\n]*/gi, '')
      .replace(/\/Lang\([^)]*\)/gi, '')
      .replace(/\b\d+\s+\d+\s+R\b/g, '')
      .replace(/%PDF-[^\n]*/gi, '')
      .replace(/AI-SIMPLIFIED AUDIO LESSON:[^\n]*/gi, '')
      .replace(/• Chapter Overview:[^\n]*/gi, '')
      .replace(/• Key Point \d+:[^\n]*/gi, '')
      .replace(/🎙️ Audio Narration Note[^\n]*/gi, '')
      .replace(/[${}\[\]\\^~|<>%#*=_`@+;:&]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return cleaned;
  };

  const getDetailedLongExplanation = (matTitle = '', questionText = '', rawExp = '') => {
    const titleLower = String(matTitle || '').toLowerCase();
    const qLower = String(questionText || '').toLowerCase();
    const cleanRaw = sanitizeStudyText(rawExp);

    if (cleanRaw && cleanRaw.length > 40 && !cleanRaw.includes('Comprehensive study lesson formatted for text-to-speech')) {
      return cleanRaw;
    }

    if (titleLower.includes('node') || titleLower.includes('js') || qLower.includes('node') || qLower.includes('v8')) {
      return "Node.js is an open-source, cross-platform JavaScript runtime environment built on Google Chrome's V8 engine. It enables developers to execute JavaScript code on the server side outside web browsers. Operating on an asynchronous, event-driven, non-blocking I/O model, Node.js handles thousands of concurrent client connections efficiently without multi-threading overhead.";
    }

    if (titleLower.includes('os') || titleLower.includes('operating') || titleLower.includes('deadlock') || qLower.includes('deadlock')) {
      return "In Operating Systems, a Deadlock occurs when two or more processes are blocked indefinitely waiting for resources held by each other. For a deadlock to exist, four Coffman conditions must hold simultaneously: Mutual Exclusion, Hold and Wait, No Preemption, and Circular Wait. Operating systems use deadlock prevention, avoidance (Banker's Algorithm), and detection strategies.";
    }

    if (titleLower.includes('net') || titleLower.includes('osi') || qLower.includes('osi') || qLower.includes('network')) {
      return "The OSI (Open Systems Interconnection) reference model organizes network communications into 7 distinct layers: Physical, Data Link, Network, Transport, Session, Presentation, and Application. Each layer performs specific functions, allowing heterogeneous hardware and software systems to communicate reliably across subnets using standardized protocols.";
    }

    if (titleLower.includes('phys') || titleLower.includes('motion') || qLower.includes('motion') || qLower.includes('force')) {
      return "Newton's Laws of Motion explain how physical objects behave under applied forces. The First Law (Inertia) states objects remain at rest or uniform motion unless acted on by a net force. The Second Law (F=ma) quantifies acceleration proportional to applied force, while the Third Law establishes equal and opposite action-reaction pairs.";
    }

    if (titleLower.includes('sec') || titleLower.includes('phish') || qLower.includes('cipher') || qLower.includes('crypto')) {
      return "Cyber Security encompasses technologies, processes, and controls designed to protect systems, networks, and data from unauthorized access or cyber attacks. Defense strategies include multi-factor authentication (MFA), TLS/SSL encryption, network firewalls, and phishing awareness to defend against social engineering.";
    }

    return `Comprehensive theoretical overview of ${matTitle || 'Study Material'}. Covers core architectural principles, key operational workflows, system configurations, and practical implementation rules formatted for blind examinees and voice narration.`;
  };

  const handleSpeakQuestionAnswerExplanation = (matTarget = null, qIdxOverride = null) => {
    const list = filteredStudyMaterials && filteredStudyMaterials.length > 0 ? filteredStudyMaterials : defaultStudyMaterials;
    const targetMat = matTarget || activePracticeMat || list[0];
    if (!targetMat) {
      speakText("No practice material or question available.");
      return;
    }

    if (!activePracticeMat || activePracticeMat.id !== targetMat.id) {
      setActivePracticeMat(targetMat);
      setPracticeAnswerInput('');
      setPracticeFeedback(null);
    }

    const targetIdx = qIdxOverride !== null ? qIdxOverride : practiceQIdx;
    setPracticeQIdx(targetIdx);
    const questionsList = (targetMat.questions && targetMat.questions.length > 0) ? targetMat.questions : [targetMat];
    const currentQ = questionsList[targetIdx] || questionsList[0];

    const qText = currentQ.text || targetMat.practiceQuestion || `Core concepts of ${targetMat.title}`;
    const ansText = currentQ.oneLineAnswer || currentQ.correctAnswer || currentQ.practiceAnswer || targetMat.practiceAnswer || targetMat.detail || 'Review lesson concepts with voice narration.';
    const expText = getDetailedLongExplanation(targetMat.title, qText, currentQ.explanation || targetMat.textContent);

    const isLongQ = (currentQ.type === 'Long answer' || currentQ.type === 'Descriptive Theory');
    const qTypeSpeech = isLongQ ? 'Long answer question' : 'Short answer question';
    const isLastQ = targetIdx >= questionsList.length - 1;
    const promptEnd = isLastQ
      ? "Say repeat question, or next question, or say your answer, and say submit."
      : "Say your answer, or say repeat question, or next question, or repeat your answer.";
    const fullMsg = `Question ${targetIdx + 1} of ${questionsList.length}, ${qTypeSpeech}. ${qText}. One-line short answer: ${ansText}. Detailed long answer explanation: ${expText}. ${promptEnd}`;

    announce(`🔊 Reading Question ${targetIdx + 1} of ${questionsList.length} for ${targetMat.title}`);
    speakText(fullMsg, () => {
      setTimeout(() => {
        listenForQuestionNavigationCommand(targetMat, targetIdx);
      }, 500);
    });
  };

  // Study Material Lesson Test Handler (Feature for Students to test material learning)
  const handleStartLessonTest = (mat) => {
    const targetMat = mat || activePracticeMat || filteredStudyMaterials[0];
    if (!targetMat) return;

    const studentEmail = (student.email || studentProfile.email || '').toLowerCase().trim();
    const existingSubmission = (studyTestResultsList || []).find(s => 
      s && (s.studentEmail === studentEmail || s.studentName === student.name) && 
      (s.materialTitle === targetMat.title || s.testId === targetMat.id)
    );

    const questions = targetMat.questions && targetMat.questions.length > 0 
      ? targetMat.questions 
      : (targetMat.testQuestions && targetMat.testQuestions.length > 0 ? targetMat.testQuestions : [
          { id: 1, text: targetMat.practiceQuestion || `What is the core principle of ${targetMat.title}?`, expectedAnswer: targetMat.practiceAnswer || targetMat.textContent },
          { id: 2, text: `Explain the key concepts and practical applications of ${targetMat.title}.`, expectedAnswer: targetMat.textContent || targetMat.detail }
        ]);

    setActiveLessonTest({
      id: targetMat.id,
      title: targetMat.title,
      subject: targetMat.subject || 'General',
      teacherEmail: targetMat.teacherEmail || '',
      teacherName: targetMat.teacherName || targetMat.publishedBy || '',
      questions: questions
    });

    if (existingSubmission) {
      setLessonTestFeedback(existingSubmission);
      if (existingSubmission.evaluated) {
        const msg = `Your test for ${targetMat.title} was evaluated by your teacher. Score: ${existingSubmission.teacherScore || existingSubmission.score} out of 10. Teacher remarks: ${existingSubmission.teacherFeedback || 'Good effort.'}`;
        announce(msg);
        speakText(msg);
      } else {
        const msg = `Your test for ${targetMat.title} has been submitted to your teacher and is currently awaiting teacher evaluation.`;
        announce(msg);
        speakText(msg);
      }
      return;
    }

    setLessonTestQIndex(0);
    setLessonTestInput('');
    setLessonTestAnswers({});
    setLessonTestFeedback(null);

    const startMsg = `Starting Study Material Test for ${targetMat.title}. Question 1: ${questions[0].text}. Dictate your answer or type in the box, then say DONE.`;
    announce(startMsg);
    speakText(startMsg);
  };

  const handleSaveLessonTestNext = () => {
    if (!activeLessonTest) return;
    const currentQ = activeLessonTest.questions[lessonTestQIndex];
    const updatedAnswers = { ...lessonTestAnswers, [currentQ.id]: lessonTestInput };
    setLessonTestAnswers(updatedAnswers);

    if (lessonTestQIndex < activeLessonTest.questions.length - 1) {
      const nextIdx = lessonTestQIndex + 1;
      setLessonTestQIndex(nextIdx);
      setLessonTestInput(updatedAnswers[activeLessonTest.questions[nextIdx].id] || '');
      speakText(`Question ${nextIdx + 1}: ${activeLessonTest.questions[nextIdx].text}`);
    } else {
      handleSubmitLessonTest(updatedAnswers);
    }
  };

  // Continuous Voice Dictation for Study Material Knowledge Test (Listens until user says DONE)
  const handleStartLessonTestDictation = (e) => {
    if (e && e.target) {
      const btn = e.target.closest('button');
      if (btn) {
        const text = btn.innerText || '';
        if (text.includes('Close') || text.includes('Listen Question')) {
          return;
        }
      }
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { alert('Speech recognition not supported in this browser.'); return; }

    cancelSpeech();

    try {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-US';

      announce("🎙️ Voice dictation active. Speak your answer, say DONE when finished.");

      rec.onstart = () => {
        setIsVoiceListening(true);
      };

      rec.onresult = (event) => {
        let currentTranscript = '';
        for (let i = 0; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        const cleaned = currentTranscript.trim();
        setLiveVoiceTranscript(cleaned);

        const lower = cleaned.toLowerCase();
        const doneKeywords = ['done', 'i am done', 'im done', 'finish', 'finished', 'submit answer', 'that is my answer', 'completed'];
        const isDone = doneKeywords.some(kw => lower.endsWith(kw) || lower.includes(`${kw}.`) || lower.includes(`${kw} `) || lower === kw);

        let cleanText = cleaned;
        doneKeywords.forEach(kw => {
          const re = new RegExp(`\\b${kw}\\b`, 'gi');
          cleanText = cleanText.replace(re, '').trim();
        });

        setLessonTestInput(cleanText);

        if (isDone) {
          try { rec.stop(); } catch (err) {}
          const currentTestQ = activeLessonTest?.questions?.[lessonTestQIndex];
          if (currentTestQ?.id) {
            setLessonTestAnswers(prev => ({ ...prev, [currentTestQ.id]: cleanText }));
          }
          announce(`✅ Recorded Answer: "${cleanText}"`);
          const promptText = `You answered: "${cleanText}". Say your command: repeat answer, or to say answer again, or next question, or repeat question, or submit.`;
          speakText(promptText);
          return;
        }
      };

      rec.onerror = () => {};
      rec.onend = () => {};

      rec.start();
    } catch (err) {}
  };

  // Submit Study Material Test to Teacher for Manual Evaluation (No Auto-Scoring)
  const handleSubmitLessonTest = (finalAnswersObj) => {
    if (!activeLessonTest) return;
    const answersToEvaluate = finalAnswersObj || lessonTestAnswers;

    const answersList = activeLessonTest.questions.map((q, idx) => ({
      questionId: q.id || idx + 1,
      questionText: q.text || `Question ${idx + 1}`,
      studentAnswer: (answersToEvaluate[q.id] || '').trim() || 'No answer submitted',
      expectedAnswer: q.expectedAnswer || q.oneLineAnswer || q.correctAnswer || '',
      explanation: q.explanation || ''
    }));

    const studentEmail = (student.email || studentProfile.email || '').toLowerCase().trim();
    const studentName = student.name || 'Student';

    const testSubmissionData = {
      id: `study_test_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      testId: activeLessonTest.id,
      studentName: studentName,
      studentId: student.studentId || 'Reg-001',
      studentEmail: studentEmail,
      materialTitle: activeLessonTest.title,
      subject: activeLessonTest.subject || 'General',
      teacherEmail: activeLessonTest.teacherEmail || '',
      teacherName: activeLessonTest.teacherName || '',
      answersList: answersList,
      answers: answersList.map(a => `${a.questionText}: ${a.studentAnswer}`).join(' | '),
      date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ', ' + new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      submittedAt: new Date().toISOString(),
      evaluated: false,
      status: 'Pending Teacher Evaluation',
      gradeStatus: 'Pending Evaluation',
      teacherScore: null,
      score: null,
      total: 10,
      percentage: null,
      teacherFeedback: '',
      evaluatedBy: '',
      evaluatedAt: null
    };

    setLessonTestFeedback(testSubmissionData);

    try {
      const existingShared = JSON.parse(localStorage.getItem('shared_study_test_results') || '[]');
      const filtered = Array.isArray(existingShared) ? existingShared.filter(s => 
        !(s && (s.studentEmail === studentEmail || s.studentName === studentName) && (s.materialTitle === activeLessonTest.title || s.testId === activeLessonTest.id))
      ) : [];
      const updatedShared = [testSubmissionData, ...filtered];
      localStorage.setItem('shared_study_test_results', JSON.stringify(updatedShared));
      setStudyTestResultsList(updatedShared);

      // Notification for teacher
      const notifObj = {
        id: `notif_${Date.now()}`,
        title: `📚 New Study Test Submitted: ${studentName}`,
        detail: `${studentName} submitted study material test for "${activeLessonTest.title}" (${activeLessonTest.subject}). Awaiting your manual evaluation.`,
        date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ', ' + new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        type: 'Study Material',
        read: false
      };
      const rawNotifs = localStorage.getItem('shared_notifications');
      const existingNotifs = rawNotifs ? JSON.parse(rawNotifs) : [];
      localStorage.setItem('shared_notifications', JSON.stringify([notifObj, ...existingNotifs]));

      window.dispatchEvent(new Event('storage'));
    } catch (e) {}

    const completionMsg = `Study material test submitted to your teacher. Your teacher will evaluate your answers and award your marks. Your score will be displayed in your dashboard once evaluated.`;
    announce("✅ " + completionMsg);
    speakText(completionMsg);
  };

  // Submit Study Material Practice to Teacher for Manual Evaluation
  const handleSubmitPracticeToTeacher = () => {
    if (!activePracticeMat) return;
    const studentEmail = (student.email || studentProfile.email || '').toLowerCase().trim();
    const studentName = student.name || 'Student';

    const questionsList = (activePracticeMat.questions && activePracticeMat.questions.length > 0)
      ? activePracticeMat.questions
      : [{
          id: 1,
          text: activePracticeMat.practiceQuestion || `Explain core concepts of ${activePracticeMat.title}`,
          oneLineAnswer: activePracticeMat.oneLineAnswer || activePracticeMat.practiceAnswer || activePracticeMat.correctAnswer || activePracticeMat.detail,
          explanation: activePracticeMat.explanation || activePracticeMat.textContent
        }];

    const safeQIdx = Math.min(practiceQIdx, questionsList.length - 1);
    const finalAnswersMap = { ...practiceAnswersByQ, [safeQIdx]: practiceAnswerInput || practiceAnswersByQ[safeQIdx] || '' };

    const answersList = questionsList.map((q, idx) => ({
      questionId: q.id || idx + 1,
      questionText: q.text || q.question || `Question ${idx + 1}`,
      studentAnswer: (finalAnswersMap[idx] || (idx === safeQIdx ? practiceAnswerInput : '') || '').trim() || 'No answer submitted',
      expectedAnswer: q.oneLineAnswer || q.correctAnswer || q.answer || activePracticeMat.practiceAnswer || activePracticeMat.oneLineAnswer || '',
      explanation: q.explanation || activePracticeMat.explanation || ''
    }));

    const practiceSubmissionData = {
      id: `study_practice_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      testId: `practice_${activePracticeMat.id}`,
      isPractice: true,
      studentName: studentName,
      studentId: student.studentId || 'Reg-001',
      studentEmail: studentEmail,
      materialTitle: `${activePracticeMat.title} (Practice)`,
      subject: activePracticeMat.subject || activeSubject || 'General',
      teacherEmail: activePracticeMat.teacherEmail || '',
      teacherName: activePracticeMat.teacherName || '',
      answersList: answersList,
      answers: answersList.map(a => `${a.questionText}: ${a.studentAnswer}`).join(' | '),
      date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ', ' + new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      submittedAt: new Date().toISOString(),
      evaluated: false,
      status: 'Pending Teacher Evaluation',
      gradeStatus: 'Pending Evaluation',
      teacherScore: null,
      score: practiceFeedback?.score !== undefined ? practiceFeedback.score : null,
      total: 10,
      percentage: null,
      teacherFeedback: '',
      evaluatedBy: '',
      evaluatedAt: null
    };

    try {
      const existingShared = JSON.parse(localStorage.getItem('shared_study_test_results') || '[]');
      const filtered = Array.isArray(existingShared) ? existingShared.filter(s => 
        !(s && (s.studentEmail === studentEmail || s.studentName === studentName) && (s.materialTitle === practiceSubmissionData.materialTitle || s.testId === practiceSubmissionData.testId))
      ) : [];
      const updatedShared = [practiceSubmissionData, ...filtered];
      localStorage.setItem('shared_study_test_results', JSON.stringify(updatedShared));
      setStudyTestResultsList(updatedShared);

      // Notification for teacher
      const notifObj = {
        id: `notif_${Date.now()}`,
        title: `📚 New Study Practice Submitted: ${studentName}`,
        detail: `${studentName} submitted study material practice answers for "${activePracticeMat.title}" (${activePracticeMat.subject || activeSubject}). Awaiting your manual evaluation.`,
        date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ', ' + new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        type: 'Study Material',
        read: false
      };
      const rawNotifs = localStorage.getItem('shared_notifications');
      const existingNotifs = rawNotifs ? JSON.parse(rawNotifs) : [];
      localStorage.setItem('shared_notifications', JSON.stringify([notifObj, ...existingNotifs]));

      window.dispatchEvent(new Event('storage'));
    } catch (e) {}

    setPracticeSubmittedMap(prev => ({ ...prev, [activePracticeMat.id]: true }));

    const completionMsg = `Study material practice submitted to your teacher for manual evaluation. Your teacher will evaluate your answers and award your marks. Your score will be displayed once evaluated.`;
    announce("✅ " + completionMsg);
    speakText(completionMsg);
  };

    const speakDashboardWelcome = () => {
    const hr = new Date().getHours();
    const timeGreeting = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
    const welcomeMsg = `${timeGreeting}, ${student?.name || 'Student'}. Welcome to your VisionAssist AI Student Dashboard. What help can I do for you? Tap anywhere on the screen, I will guide you.`;
    announce(welcomeMsg);
    speakText(welcomeMsg);
  };

  const speakDashboardFeatures = () => {
    const featuresSpeech = `Here are all 11 features present in your VisionAssist AI Student Dashboard:
    Feature 1: Dashboard Overview, with your academic progress and quick action shortcuts.
    Feature 2: AI Exam Assistant, providing accessible step-by-step voice-guided online exams.
    Feature 3: AI Oral Viva Simulator, to practice voice interviews and oral test evaluations.
    Feature 4: My Exams, showing all your active and scheduled tests in ${activeSubject || 'your subjects'}.
    Feature 5: Results and Performance, showing your scores, percentages, and teacher evaluations.
    Feature 6: Voice Certificates, where you can view and download your earned course completion certificates.
    Feature 7: Study Materials and Audio Lessons, to listen to audio explanations, reference answers, and take topic tests.
    Feature 8: Voice Assistant, for complete hands-free voice navigation.
    Feature 9: Accessibility Settings, allowing high contrast mode and voice speed adjustments.
    Feature 10: Notifications and Teacher Broadcasts, for real-time announcements.
    Feature 11: Student Profile, to view your details, registration number, and select your interested subjects.
    
    You can tap anywhere on the screen at any time to activate the voice assistant and speak any command, or change your interested subject.`;

    announce("📢 Reading all 11 Student Dashboard features aloud...");
    speakText(featuresSpeech);
  };

  // On dashboard entry: speak initial welcome once per session (survives React StrictMode double-mount)
  useEffect(() => {
    let active = true;
    const speechTimer = setTimeout(() => {
      if (!active) return;
      if (hasSpokenMountFeaturesRef.current) return;
      hasSpokenMountFeaturesRef.current = true;
      if (!isVoiceDisabled()) {
        speakDashboardWelcome();
      }
    }, 700);
    return () => {
      active = false;
      clearTimeout(speechTimer);
    };
  }, []);

  // Hover / touch announcer: whatever the mouse or finger rests on is spoken aloud immediately
  useEffect(() => {
    let lastSpokenEl = null;

    const describe = (el) => {
      if (!el) return null;
      const target = el.closest('button, a, input, select, textarea, [role="button"], [role="tab"], [role="option"], [aria-label], [title], [data-speech], [data-narrate], h1, h2, h3, h4, label, li, tr, .card, [class*="card"]');
      if (!target) return null;

      const customSpeech = target.getAttribute('data-speech') || target.getAttribute('data-narrate');
      if (customSpeech) return { target, text: customSpeech };

      const aria = target.getAttribute('aria-label') || target.getAttribute('title');
      let text = aria || '';
      if (!text) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') {
          text = `${target.placeholder || target.name || 'Text'} input field${target.value ? ', current value ' + target.value : ''}`;
        } else if (tag === 'SELECT') {
          text = `Dropdown, selected ${target.options[target.selectedIndex]?.text || 'none'}`;
        } else {
          text = (target.innerText || '').replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').replace(/\s+/g, ' ').trim();
        }
      }
      if (!text) return null;
      if (text.length > 160) text = text.slice(0, 160);
      const tag = target.tagName;
      const kind = (tag === 'BUTTON' || target.getAttribute('role') === 'button') && !text.toLowerCase().includes('button') ? ' button'
        : tag === 'A' && !text.toLowerCase().includes('link') ? ' link'
        : (target.getAttribute('role') === 'tab' || target.getAttribute('role') === 'option') && !text.toLowerCase().includes('tab') && !text.toLowerCase().includes('option') ? ' option' : '';
      return { target, text: text + kind };
    };

    const onPointerOver = (e) => {
      if (isVoiceDisabled() || isVoiceListeningRef.current) return;
      const info = describe(e.target);
      if (!info || !info.text) return;
      if (info.target === lastSpokenEl) return;
      lastSpokenEl = info.target;
      speakHover(info.text, 80);
    };

    const onPointerOut = (e) => {
      if (!e.relatedTarget || !document.contains(e.relatedTarget)) {
        lastSpokenEl = null;
        resetHoverSpeech();
      }
    };

    document.addEventListener('mouseover', onPointerOver);
    document.addEventListener('focusin', onPointerOver);
    document.addEventListener('mouseout', onPointerOut);
    return () => {
      document.removeEventListener('mouseover', onPointerOver);
      document.removeEventListener('focusin', onPointerOver);
      document.removeEventListener('mouseout', onPointerOut);
      resetHoverSpeech();
    };
  }, []);

  // Sync live broadcast alerts and study materials from Teacher Dashboard
  useEffect(() => {
    const syncSharedData = () => {
      try {
        const rawB = localStorage.getItem('shared_voice_broadcasts');
        if (rawB) {
          const parsed = JSON.parse(rawB);
          if (Array.isArray(parsed)) setBroadcasts(parsed);
        }
        const rawM = localStorage.getItem('shared_study_materials');
        if (rawM) {
          const parsedM = JSON.parse(rawM);
          if (Array.isArray(parsedM)) {
            const filtered = parsedM.filter(m => 
              !(m.id === 1 && m.title === 'Physics: Motion & Laws of Force') && 
              !(m.id === 2 && m.title === 'Computer Networks: OSI Model & Protocols') && 
              !(m.id === 3 && m.title === 'Mathematics: Algebra & Equations') &&
              !(m.id === 1 && m.title === 'Computer Networks OSI Layer Guide (PDF)') &&
              !(m.id === 2 && m.title === 'OS Deadlocks Audio Lecture & Voice Notes') &&
              !(m.id === 3 && m.title === 'Cyber Security Phishing Defense Book')
            );
            const cleaned = sanitizeStudyMaterialList(filtered);
            setStudyMaterials(cleaned);
          }
        }
        const rawTestResults = localStorage.getItem('shared_study_test_results');
        if (rawTestResults) {
          try {
            const parsedTR = JSON.parse(rawTestResults);
            if (Array.isArray(parsedTR)) setStudyTestResultsList(parsedTR);
          } catch (e) {}
        }
        const rawV = localStorage.getItem('shared_oral_vivas');
        if (rawV) {
          const parsedV = JSON.parse(rawV);
          if (Array.isArray(parsedV)) {
            const filtered = parsedV.filter(isTeacherPublishedOralViva);
            setOralVivas(filtered);
            setVivaSubject(prev => {
              if (!prev || !filtered.some(v => v.title === prev || v.subject === prev || String(v.id) === prev)) {
                return filtered.length > 0 ? (filtered[0].title || filtered[0].subject) : '';
              }
              return prev;
            });
          }
        }
        const rawVivaSubs = localStorage.getItem('shared_viva_submissions');
        if (rawVivaSubs) {
          const parsedSubs = JSON.parse(rawVivaSubs);
          if (Array.isArray(parsedSubs)) {
            setVivaSubmissionsList(parsedSubs);
          }
        }
      } catch (e) {}
    };

    syncSharedData();
    window.addEventListener('storage', syncSharedData);
    return () => window.removeEventListener('storage', syncSharedData);
  }, []);

  // Timer effect for active exam
  useEffect(() => {
    let timer = null;
    if (currentExam && !examSubmitted && examTimeRemaining > 0) {
      timer = setInterval(() => {
        setExamTimeRemaining(prev => {
          if (prev === 1800) speakText("30 minutes remaining in your exam.");
          if (prev === 300) speakText("Warning: Only 5 minutes remaining.");
          if (prev <= 1) {
            clearInterval(timer);
            setExamSubmitted(true);
            speakText("Time is up. Your exam has been submitted automatically.");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [currentExam, examSubmitted, examTimeRemaining]);

  // Continuous Real-Time Live Monitoring sync for Teacher Dashboard while student is writing exam
  useEffect(() => {
    if (!currentExam || examSubmitted || !isExamActive) return;

    const syncLiveLog = () => {
      try {
        const sName = studentProfile?.name || student?.name || 'Examinee';
        const sEmail = studentProfile?.email || student?.email || '';
        const mins = Math.floor(examTimeRemaining / 60);
        const secs = examTimeRemaining % 60;
        const remainingStr = `${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
        const totalQs = (currentExam.questions || []).length || 1;
        const ansCount = getExamQuestionsAnsweredCount(currentExam, studentAnswers, currentAnswerInput, currentQIndex);
        const isWriting = !isOtherPersonDetected && isScannedStudentWriting && !isCameraOff;
        const voiceStatus = isCameraOff
          ? '🔒 Locked (Camera Off)'
          : isOtherPersonDetected 
            ? '🔒 Locked (Unauthorized Person)' 
            : (isDictatingExamAnswer ? '🗣️ Dictating Answer...' : 'Active (Voice Dictation)');

        const existingLogs = JSON.parse(localStorage.getItem('shared_live_logs') || '[]');
        const existingEntry = existingLogs.find(l => l && (l.student === sName || l.studentEmail === sEmail));

        const statusText = isCameraOff
          ? '🔴 CAMERA TURNED OFF (ALERT)'
          : isWriting 
            ? '🟢 Writing' 
            : '🔴 OTHERS WRITING (ALERT)';

        const statusBadgeText = isCameraOff
          ? `🔴 CAMERA OFF: ${sName}`
          : isWriting 
            ? `🟢 Writing: ${sName}` 
            : `🔴 ALERT: ${sName}`;

        const updatedEntry = {
          id: existingEntry?.id || `log_${currentExam.id || currentExam._id || Date.now()}`,
          student: sName,
          studentName: sName,
          studentEmail: sEmail,
          teacherEmail: currentExam.teacherEmail || currentExam.creatorEmail || existingEntry?.teacherEmail || '',
          teacherName: currentExam.teacherName || existingEntry?.teacherName || '',
          examId: currentExam.id || currentExam._id || existingEntry?.examId || '',
          examTitle: currentExam.title || existingEntry?.examTitle || 'Theory Assessment',
          subject: currentExam.subject || existingEntry?.subject || 'Computer Science',
          status: statusText,
          statusBadge: statusBadgeText,
          started: existingEntry?.started || existingEntry?.start || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          start: existingEntry?.started || existingEntry?.start || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          remaining: remainingStr,
          answered: `${ansCount} / ${totalQs}`,
          voice: voiceStatus,
          submitted: 'No',
          faceVerified: !isCameraOff,
          facePresent: !isCameraOff,
          isCameraOff: isCameraOff,
          isOtherPerson: isOtherPersonDetected || isCameraOff,
          isMultiplePeople: false,
          timestamp: Date.now()
        };

        const otherLogs = existingLogs.filter(l => l && l.student !== sName && l.studentEmail !== sEmail);
        localStorage.setItem('shared_live_logs', JSON.stringify([updatedEntry, ...otherLogs]));
        window.dispatchEvent(new Event('storage'));
      } catch (e) {}
    };

    syncLiveLog();
    const interval = setInterval(syncLiveLog, 2000);
    return () => clearInterval(interval);
  }, [currentExam, examSubmitted, isExamActive, examTimeRemaining, studentAnswers, isOtherPersonDetected, isScannedStudentWriting, isCameraOff, isDictatingExamAnswer, studentProfile?.name, student?.name]);

  // Overall Performance average strictly for focused subject
  const overallProgress = useMemo(() => {
    if (!filteredResults.length) return 0;
    return Math.round(filteredResults.reduce((acc, r) => acc + (r.score / r.total) * 100, 0) / filteredResults.length);
  }, [filteredResults]);

  // Extract enrolled student face biometric vector whenever profile photo updates
  useEffect(() => {
    if (studentProfile.profilePic) {
      extractBiometricFeaturesFromImage(studentProfile.profilePic).then(vec => {
        enrolledFaceVectorRef.current = vec;
      });
    } else {
      enrolledFaceVectorRef.current = null;
    }
  }, [studentProfile.profilePic]);

  // Profile Tab: Snap and Register Official Face Photo with Webcam
  const handleOpenProfileSnapModal = async () => {
    setIsProfileSnapModalOpen(true);
    speakText("Webcam activated. Align your face clearly in the camera frame and click Capture Photo.");
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
          audio: false
        });
        snapStreamRef.current = stream;
        if (snapVideoRef.current) {
          snapVideoRef.current.srcObject = stream;
          snapVideoRef.current.play().catch(() => {});
        }
      }
    } catch (err) {
      console.warn("Profile webcam error:", err);
      speakText("Could not access camera. Please allow camera permissions to capture your profile photo.");
    }
  };

  const handleCloseProfileSnapModal = () => {
    setIsProfileSnapModalOpen(false);
    if (snapStreamRef.current) {
      try {
        snapStreamRef.current.getTracks().forEach(t => t.stop());
      } catch (e) {}
      snapStreamRef.current = null;
    }
    if (snapVideoRef.current) {
      snapVideoRef.current.srcObject = null;
    }
  };

  const handleCaptureProfilePhoto = () => {
    if (!snapVideoRef.current || !snapCanvasRef.current) return;
    const video = snapVideoRef.current;
    const canvas = snapCanvasRef.current;
    canvas.width = video.videoWidth || 320;
    canvas.height = video.videoHeight || 240;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const snapUrl = canvas.toDataURL('image/jpeg', 0.9);
    
    const updated = { ...studentProfile, profilePic: snapUrl };
    setStudentProfile(updated);
    setProfileEditForm(updated);
    try {
      localStorage.setItem('student_profile_pic', snapUrl);
      localStorage.setItem('last_active_student_profile_pic', snapUrl);
      const session = JSON.parse(localStorage.getItem('auth_session') || '{}');
      session.profilePic = snapUrl;
      localStorage.setItem('auth_session', JSON.stringify(session));
      const cleanEmail = (session.email || updated.email || '').trim().toLowerCase();
      if (cleanEmail) {
        const allProfiles = JSON.parse(localStorage.getItem('student_profiles_by_email') || '{}');
        allProfiles[cleanEmail] = { ...(allProfiles[cleanEmail] || {}), ...updated, profilePic: snapUrl };
        localStorage.setItem('student_profiles_by_email', JSON.stringify(allProfiles));
      }
      window.dispatchEvent(new Event('storage'));
    } catch (err) {}

    extractBiometricFeaturesFromImage(snapUrl).then(vec => {
      if (vec) enrolledFaceVectorRef.current = vec;
    });

    handleCloseProfileSnapModal();
    announce("📸 Official profile photo registered successfully!");
    speakText("Profile photo captured and registered successfully. Your biometric reference face is now enrolled for exam security!");
  };

  // Face Verification & Camera Proctoring Management
  const stopCameraForFaceAuth = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (proctorScanIntervalRef.current) {
      clearInterval(proctorScanIntervalRef.current);
      proctorScanIntervalRef.current = null;
    }
    if (mediaStreamRef.current) {
      try {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      } catch (e) {}
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (proctorVideoRef.current) {
      proctorVideoRef.current.srcObject = null;
    }
  };

  const handleEnrollProfilePhotoFromExamModal = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 320;
    canvas.height = video.videoHeight || 240;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const snapUrl = canvas.toDataURL('image/jpeg', 0.9);

    const updated = { ...studentProfile, profilePic: snapUrl };
    setStudentProfile(updated);
    setProfileEditForm(updated);
    try {
      localStorage.setItem('student_profile_pic', snapUrl);
      localStorage.setItem('last_active_student_profile_pic', snapUrl);
      const session = JSON.parse(localStorage.getItem('auth_session') || '{}');
      session.profilePic = snapUrl;
      localStorage.setItem('auth_session', JSON.stringify(session));
      const cleanEmail = (session.email || updated.email || '').trim().toLowerCase();
      if (cleanEmail) {
        const allProfiles = JSON.parse(localStorage.getItem('student_profiles_by_email') || '{}');
        allProfiles[cleanEmail] = { ...(allProfiles[cleanEmail] || {}), ...updated, profilePic: snapUrl };
        localStorage.setItem('student_profiles_by_email', JSON.stringify(allProfiles));
      }
      window.dispatchEvent(new Event('storage'));
    } catch (err) {}

    const vec = await extractBiometricFeaturesFromImage(snapUrl);
    if (vec) enrolledFaceVectorRef.current = vec;

    announce("📸 Official profile photo registered! Now verifying your face against it...");
    speakText("Official profile photo captured and registered. Now verifying your live face against your official profile.");
  };

  const startCameraForFaceAuth = async (targetExam) => {
    setPendingExamToStart(targetExam);
    setFaceAuthModalOpen(true);
    setFaceDetecting(true);
    setFaceDetected(false);
    setFaceConfidence(0);
    setFaceMatchScore(0);
    setFaceScanProgress(0);
    setFaceErrorMessage('');
    setIsMultiplePeopleDetected(false);
    isMultiplePeopleDetectedRef.current = false;
    consecutiveMultiplePeopleCountRef.current = 0;
    setShowMultiplePeopleWarningModal(false);
    setFaceMismatchStrikeCount(0);
    faceMismatchStrikeCountRef.current = 0;
    consecutiveMismatchTicksRef.current = 0;
    lastMismatchAlertTimeRef.current = 0;
    setFaceMismatchActiveAlert(null);
    setExamTerminationModal(null);
    setFaceMatchStatus('Align your face inside the camera circle to scan and verify your identity...');
    setFaceScanStage('center');
    scanStageRef.current = 'center';
    setScannedAnglesState({ center: false, left: false, right: false });
    scannedAnglesStateRef.current = { center: false, left: false, right: false };
    setScannedAnglesThumbs({ center: null, left: null, right: null });
    scannedExamFaceVectorsRef.current = { center: null, left: null, right: null };
    stageStableTicksRef.current = 0;

    // Prioritize checking & loading registered profile picture
    const cleanEmail = (student.email || '').trim().toLowerCase();
    const allProfiles = JSON.parse(localStorage.getItem('student_profiles_by_email') || '{}');
    const userProf = allProfiles[cleanEmail] || {};
    const session = JSON.parse(localStorage.getItem('auth_session') || '{}');
    const refPic = 
      studentProfile.profilePic || 
      userProf.profilePic || 
      session.profilePic || 
      localStorage.getItem('student_profile_pic') || 
      localStorage.getItem('last_active_student_profile_pic') || 
      (allProfiles['default']?.profilePic) ||
      (Object.values(allProfiles).find(p => p && p.profilePic)?.profilePic) ||
      null;

    if (refPic && !studentProfile.profilePic) {
      setStudentProfile(prev => ({ ...prev, profilePic: refPic }));
    }
    if (refPic) {
      extractBiometricFeaturesFromImage(refPic).then(vec => {
        if (vec) enrolledFaceVectorRef.current = vec;
      });
    } else {
      enrolledFaceVectorRef.current = null;
    }

    const voicePrompt = refPic
      ? `Compulsory Exam Security: Verifying candidate face for ${student.name} against registered profile picture. Please position your face in the camera.`
      : `Compulsory Exam Security: Registered profile photo missing for ${student.name}. A student cannot write an exam without a registered profile photo. Please click Capture Profile Photo to enroll.`;
    announce("📷 Candidate Face Scanner Active");
    speakText(voicePrompt);

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: { ideal: 1280, min: 640 }, height: { ideal: 720, min: 480 }, facingMode: 'user' }, 
          audio: false 
        });
        mediaStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      } else {
        setFaceErrorMessage("Camera is not supported on this browser.");
      }
    } catch (err) {
      console.warn("Camera access error:", err);
      setFaceErrorMessage("Camera access is required. Please grant camera permission to attend your exam.");
      speakText("Camera access denied. Please enable camera permission to complete candidate face scanning.");
    }
  };

  // Multi-angle Face Scanning & Biometric Lock (Center, Left, Right)
  useEffect(() => {
    if (!faceAuthModalOpen) {
      return;
    }

    stageStableTicksRef.current = 0;
    scanStageRef.current = 'center';
    setFaceScanStage('center');
    setScannedAnglesState({ center: false, left: false, right: false });
    scannedAnglesStateRef.current = { center: false, left: false, right: false };
    setScannedAnglesThumbs({ center: null, left: null, right: null });
    scannedExamFaceVectorsRef.current = { center: null, left: null, right: null };

    // Auditory opening prompt for accessibility
    setTimeout(() => {
      speakText("Candidate Face Biometric Scanner. Step 1 of 3: Look straight into the camera to scan center face.");
    }, 400);

    scanIntervalRef.current = setInterval(async () => {
      if (!videoRef.current || !canvasRef.current) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video.readyState < 2) return;

      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      try {
        const peopleCheck = await detectPeopleInCanvas(canvas);
        if (peopleCheck.lightingQuality) {
          setCameraLightingFeedback(peopleCheck.lightingQuality);
        }
        const liveVector = extractBiometricFeaturesFromCanvas(canvas, peopleCheck.primaryFaceBox);
        let refVector = enrolledFaceVectorRef.current;

        // Auto-heal / load biometric vector if photo exists but vector was not yet resolved
        if (!refVector) {
          const availPic = studentProfile.profilePic || localStorage.getItem('student_profile_pic') || localStorage.getItem('last_active_student_profile_pic');
          if (availPic) {
            setFaceMatchStatus("⏳ Loading registered profile biometric template...");
            extractBiometricFeaturesFromImage(availPic).then(vec => {
              if (vec) enrolledFaceVectorRef.current = vec;
            });
            return;
          }
          // STRICT MANDATORY PROFILE PHOTO CHECK: A student CANNOT write an exam without a matching profile photo!
          stageStableTicksRef.current = 0;
          setFaceScanProgress(0);
          setFaceConfidence(0);
          setFaceMatchScore(0);
          setFaceMatchStatus("🔴 NO REGISTERED PROFILE PHOTO — Exam Access Blocked");
          setFaceErrorMessage(`Compulsory Requirement: No registered profile photo found for ${student.name}. A student cannot write an exam without a matching profile photo. Please click "Capture & Register Official Profile Photo" below.`);
          return;
        }

        if (peopleCheck.isMultiple) {
          consecutiveMultiplePeopleCountRef.current++;
          if (consecutiveMultiplePeopleCountRef.current >= 4) {
            setIsMultiplePeopleDetected(true);
            isMultiplePeopleDetectedRef.current = true;
            setDetectedPeopleCount(peopleCheck.count);
            setFaceConfidence(0);
            setFaceMatchScore(0);
            stageStableTicksRef.current = 0;
            setFaceErrorMessage(`⚠️ Multiple people detected in camera (${peopleCheck.count} individuals)! Examination requires strictly single candidate ${student.name}. Please ensure you are alone.`);
            setFaceMatchStatus(`🔴 Multiple people detected (${peopleCheck.count} People) — Please be alone`);

            const now = Date.now();
            if (now - lastMultiplePeopleWarningTimeRef.current > 7000) {
              lastMultiplePeopleWarningTimeRef.current = now;
              speakText(`Warning: Multiple people detected in camera view. Only candidate ${student.name} must be in front of the camera.`);
            }
          }
          return;
        } else {
          setIsMultiplePeopleDetected(false);
          isMultiplePeopleDetectedRef.current = false;
          consecutiveMultiplePeopleCountRef.current = 0;
        }

        if (!peopleCheck.isPresent) {
          stageStableTicksRef.current = Math.max(0, stageStableTicksRef.current - 1);
          setFaceConfidence(0);
          setFaceMatchScore(0);
          const stagePrompt = scanStageRef.current === 'center'
            ? '🎯 Step 1: Align your face looking straight into the camera...'
            : scanStageRef.current === 'left'
              ? '👈 Step 2: Turn your face slightly to the left...'
              : '👉 Step 3: Turn your face slightly to the right...';
          setFaceMatchStatus(stagePrompt);
          setFaceErrorMessage("Please position your face clearly inside the oval target.");
          return;
        }

        // Biometric similarity check against enrolled profile picture and center vector
        let similarity = 0;
        if (refVector && liveVector) {
          similarity = computeBiometricSimilarity(refVector, liveVector);
        }
        let centerSim = 0;
        if (scannedExamFaceVectorsRef.current.center && liveVector) {
          centerSim = computeBiometricSimilarity(scannedExamFaceVectorsRef.current.center, liveVector);
        }
        let leftSim = 0;
        if (scannedExamFaceVectorsRef.current.left && liveVector) {
          leftSim = computeBiometricSimilarity(scannedExamFaceVectorsRef.current.left, liveVector);
        }

        const matchPercent = Math.min(99, Math.round(similarity * 100));
        setFaceConfidence(matchPercent);
        setFaceMatchScore(matchPercent);

        const currentStage = scanStageRef.current;
        let isStageMatch = false;

        if (currentStage === 'center') {
          // Profile photo is frontal: require strong correlation
          isStageMatch = Boolean(similarity >= 0.40);
        } else if (currentStage === 'left') {
          // Turned left: Candidate MUST rotate head to left profile!
          // If centerSim is high (>= 0.86), candidate is still looking straight at center!
          const isStillLookingCenter = centerSim >= 0.86;
          const isCandidateMatch = (similarity >= 0.22 || (centerSim >= 0.30 && centerSim < 0.86));
          if (isStillLookingCenter) {
            stageStableTicksRef.current = 0;
            setFaceErrorMessage("⚠️ Turn your head to the LEFT 👈. Currently looking center.");
            setFaceMatchStatus("👈 Step 2: Please turn your face slightly to the left...");
          } else if (isCandidateMatch) {
            isStageMatch = true;
          }
        } else if (currentStage === 'right') {
          // Turned right: Candidate MUST rotate head to right profile!
          // If centerSim >= 0.86 (looking center) or leftSim >= 0.86 (looking left), reject!
          const isStillLookingCenter = centerSim >= 0.86;
          const isStillLookingLeft = leftSim >= 0.86;
          const isCandidateMatch = (similarity >= 0.22 || (centerSim >= 0.30 && centerSim < 0.86));
          if (isStillLookingCenter) {
            stageStableTicksRef.current = 0;
            setFaceErrorMessage("⚠️ Turn your head to the RIGHT 👉. Please turn away from center.");
            setFaceMatchStatus("👉 Step 3: Please turn your face slightly to the right...");
          } else if (isStillLookingLeft) {
            stageStableTicksRef.current = 0;
            setFaceErrorMessage("⚠️ Turn your head to the RIGHT 👉. Left profile is already locked.");
            setFaceMatchStatus("👉 Step 3: Please turn your face slightly to the right...");
          } else if (isCandidateMatch) {
            isStageMatch = true;
          }
        }

        if (isStageMatch) {
          setFaceErrorMessage('');
          stageStableTicksRef.current++;

          if (currentStage === 'center') {
            const centerProg = Math.min(33, stageStableTicksRef.current * 11);
            setFaceScanProgress(centerProg);
            setFaceMatchStatus(`🟢 Step 1: Scanning Center Face (${centerProg}%)... Candidate: ${student.name}`);

            if (stageStableTicksRef.current >= 3) {
              const snap = canvas.toDataURL('image/jpeg', 0.88);
              scannedExamFaceVectorsRef.current.center = liveVector;
              scannedExamFaceVectorRef.current = liveVector;
              scannedAnglesStateRef.current.center = true;
              setScannedAnglesState(prev => ({ ...prev, center: true }));
              setScannedAnglesThumbs(prev => ({ ...prev, center: snap }));
              setFaceSnapshotUrl(snap);
              setScannedExamFaceUrl(snap);

              scanStageRef.current = 'left';
              setFaceScanStage('left');
              stageStableTicksRef.current = 0;
              setFaceScanProgress(34);
              setFaceMatchStatus("✓ Center Angle Captured! Step 2: Now turn your face slightly to the left 👈");
              announce("Center angle verified. Now turn your face slightly to the left.");
              speakText("Center angle verified. Now turn your face slightly to the left.");
            }
          } else if (currentStage === 'left') {
            const leftProg = 33 + Math.min(33, stageStableTicksRef.current * 11);
            setFaceScanProgress(leftProg);
            setFaceMatchStatus(`🟢 Step 2: Scanning Left Angle (${leftProg}%)... Candidate: ${student.name}`);

            if (stageStableTicksRef.current >= 3) {
              const snap = canvas.toDataURL('image/jpeg', 0.88);
              scannedExamFaceVectorsRef.current.left = liveVector;
              scannedAnglesStateRef.current.left = true;
              setScannedAnglesState(prev => ({ ...prev, left: true }));
              setScannedAnglesThumbs(prev => ({ ...prev, left: snap }));

              scanStageRef.current = 'right';
              setFaceScanStage('right');
              stageStableTicksRef.current = 0;
              setFaceScanProgress(67);
              setFaceMatchStatus("✓ Left Angle Captured! Step 3: Now turn your face slightly to the right 👉");
              announce("Left angle verified. Now turn your face slightly to the right.");
              speakText("Left angle verified. Now turn your face slightly to the right.");
            }
          } else if (currentStage === 'right') {
            const rightProg = 66 + Math.min(34, stageStableTicksRef.current * 12);
            setFaceScanProgress(rightProg);
            setFaceMatchStatus(`🟢 Step 3: Scanning Right Angle (${rightProg}%)... Candidate: ${student.name}`);

            if (stageStableTicksRef.current >= 3) {
              const snap = canvas.toDataURL('image/jpeg', 0.88);
              scannedExamFaceVectorsRef.current.right = liveVector;
              scannedAnglesStateRef.current.right = true;
              setScannedAnglesState(prev => ({ ...prev, right: true }));
              setScannedAnglesThumbs(prev => ({ ...prev, right: snap }));

              scanStageRef.current = 'complete';
              setFaceScanStage('complete');
              setFaceScanProgress(100);
              clearInterval(scanIntervalRef.current);
              scanIntervalRef.current = null;

              setFaceDetecting(false);
              setFaceDetected(true);
              setIsFaceVerifiedForExam(true);
              setIsFacePresentInExam(true);
              setIsScannedStudentWriting(true);
              setIsOtherPersonDetected(false);
              setIsMultiplePeopleDetected(false);
              isScannedStudentWritingRef.current = true;

              // Record multi-angle face verification in shared logs for Teacher Dashboard
              try {
                const existingLogs = JSON.parse(localStorage.getItem('shared_live_logs') || '[]');
                const updatedLog = {
                  id: `log_${Date.now()}`,
                  student: student.name,
                  studentName: student.name,
                  teacherEmail: pendingExamToStart?.teacherEmail || '',
                  teacherName: pendingExamToStart?.teacherName || '',
                  examId: pendingExamToStart?.id || pendingExamToStart?._id || '',
                  examTitle: pendingExamToStart?.title || '',
                  status: 'Multi-Angle Face Verified & Active',
                  statusBadge: '🟢 Verified (All Angles): ' + student.name,
                  started: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  remaining: '01:00:00',
                  answered: `0 / ${(pendingExamToStart?.questions || []).length || 2}`,
                  voice: 'Active (en-US)',
                  submitted: 'No',
                  faceVerified: true,
                  facePresent: true,
                  faceSnapshot: snap,
                  multiAngleVerified: true
                };
                localStorage.setItem('shared_live_logs', JSON.stringify([updatedLog, ...existingLogs.filter(l => l.student !== student.name)]));
                window.dispatchEvent(new Event('storage'));
              } catch (e) {}

              const successMsg = `Multi-angle biometric scan complete. Center, left, and right verified for ${student.name}. Entering exam now.`;
              announce(successMsg);
              speakText(successMsg, () => {
                setFaceAuthModalOpen(false);
                if (pendingExamToStart) {
                  launchActualExam(pendingExamToStart);
                }
              });
            }
          }
        } else if (matchPercent >= 32) {
          // Face in frame, aligning
          setFaceErrorMessage('');
          const stagePrompt = currentStage === 'center'
            ? `⏳ Aligning center face features... (${matchPercent}% match)`
            : currentStage === 'left'
              ? `👈 Aligning left face profile... (${matchPercent}% match)`
              : `👉 Aligning right face profile... (${matchPercent}% match)`;
          setFaceMatchStatus(stagePrompt);
        } else {
          // Mismatch against candidate
          setFaceErrorMessage(`Identity Mismatch: Live face does not match registered profile photo of ${student.name} (${matchPercent}% match). Please ensure proper lighting and face the camera.`);
          setFaceMatchStatus(`🔴 Face Mismatch (${matchPercent}% match): Unverified Face`);
        }
      } catch (e) {}
    }, 250);

    return () => {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }
    };
  }, [faceAuthModalOpen, pendingExamToStart, student, studentProfile.profilePic]);

  // Instant Manual Scan & Lock Face Button for Examinee across stages (Center -> Left -> Right -> Enter)
  const handleManualPassFaceAuth = async () => {
    if (!canvasRef.current || !videoRef.current) return;
    try {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const snapshotDataUrl = canvas.toDataURL('image/jpeg', 0.88);

      const peopleCheck = await detectPeopleInCanvas(canvas);
      if (peopleCheck.isMultiple) {
        setIsMultiplePeopleDetected(true);
        isMultiplePeopleDetectedRef.current = true;
        setDetectedPeopleCount(peopleCheck.count);
        setFaceErrorMessage(`⚠️ Multiple people detected in camera (${peopleCheck.count} individuals)! Examination requires strictly single candidate ${student.name}. Please ensure you are alone.`);
        setFaceMatchStatus(`🔴 Multiple people detected! Examination blocked.`);
        speakText(`Multiple people detected in front of the camera. Only candidate ${student.name} is permitted.`);
        return;
      }

      if (!peopleCheck.isPresent) {
        setFaceErrorMessage("No candidate face detected. Please position your face inside the camera circle.");
        speakText("No face detected. Please position your face inside the circle.");
        return;
      }

      const liveVector = extractBiometricFeaturesFromCanvas(canvas, peopleCheck.primaryFaceBox);

      let refVector = enrolledFaceVectorRef.current;
      if (!refVector) {
        const availPic = studentProfile.profilePic || localStorage.getItem('student_profile_pic') || localStorage.getItem('last_active_student_profile_pic');
        if (availPic) {
          refVector = await extractBiometricFeaturesFromImage(availPic);
          if (refVector) enrolledFaceVectorRef.current = refVector;
        }
      }

      if (!refVector) {
        setFaceErrorMessage(`Mandatory Exam Requirement: No registered profile photo found for ${student.name}. Please register your profile photo first.`);
        speakText(`Identity verification failed. No registered profile photo found for ${student.name}. You cannot write this exam.`);
        return;
      }

      const sim = computeBiometricSimilarity(refVector, liveVector);
      const matchScore = Math.round(sim * 100);

      // Verify on center stage
      if (scanStageRef.current === 'center' && sim < 0.35) {
        setFaceErrorMessage(`Face Mismatch (${matchScore}% match)! Live face does not match registered profile photo of ${student.name}.`);
        speakText(`Identity verification failed. Your face does not match the registered profile photo of ${student.name}.`);
        return;
      }

      setIsMultiplePeopleDetected(false);
      isMultiplePeopleDetectedRef.current = false;
      setFaceConfidence(Math.max(matchScore, 50));
      setFaceMatchScore(Math.max(matchScore, 50));

      const activeStage = scanStageRef.current;
      let centerSim = 0;
      if (scannedExamFaceVectorsRef.current.center && liveVector) {
        centerSim = computeBiometricSimilarity(scannedExamFaceVectorsRef.current.center, liveVector);
      }
      let leftSim = 0;
      if (scannedExamFaceVectorsRef.current.left && liveVector) {
        leftSim = computeBiometricSimilarity(scannedExamFaceVectorsRef.current.left, liveVector);
      }

      if (activeStage === 'center') {
        scannedExamFaceVectorsRef.current.center = liveVector;
        scannedExamFaceVectorRef.current = liveVector;
        scannedAnglesStateRef.current.center = true;
        setScannedAnglesState(prev => ({ ...prev, center: true }));
        setScannedAnglesThumbs(prev => ({ ...prev, center: snapshotDataUrl }));
        setFaceSnapshotUrl(snapshotDataUrl);
        setScannedExamFaceUrl(snapshotDataUrl);

        scanStageRef.current = 'left';
        setFaceScanStage('left');
        setFaceScanProgress(34);
        setFaceMatchStatus("✓ Step 1 Center locked! Step 2: Now turn your face slightly to the left 👈");
        announce("Center angle locked. Now turn your face slightly to the left.");
        speakText("Center angle locked. Now turn your face slightly to the left.");
      } else if (activeStage === 'left') {
        // Candidate must have turned left, not still looking center!
        if (centerSim >= 0.86) {
          const warningMsg = "Please turn your face to the left to capture your left profile. Your face is still looking straight at center.";
          setFaceErrorMessage("⚠️ Turn face to the LEFT 👈. Center face is already locked for Step 1. Please turn your head.");
          setFaceMatchStatus("👈 Turn your face to the left to lock Step 2.");
          announce(warningMsg);
          speakText(warningMsg);
          return;
        }

        scannedExamFaceVectorsRef.current.left = liveVector;
        scannedAnglesStateRef.current.left = true;
        setScannedAnglesState(prev => ({ ...prev, left: true }));
        setScannedAnglesThumbs(prev => ({ ...prev, left: snapshotDataUrl }));

        scanStageRef.current = 'right';
        setFaceScanStage('right');
        setFaceScanProgress(67);
        setFaceMatchStatus("✓ Step 2 Left locked! Step 3: Now turn your face slightly to the right 👉");
        announce("Left angle locked. Now turn your face slightly to the right.");
        speakText("Left angle locked. Now turn your face slightly to the right.");
      } else {
        // Step 3: Candidate must have turned right, not still looking center or left!
        if (centerSim >= 0.86) {
          const warningMsg = "Please turn your face to the right to capture your right profile. Your face is still looking straight at center.";
          setFaceErrorMessage("⚠️ Turn face to the RIGHT 👉. Center face is already locked for Step 1. Please turn your head.");
          setFaceMatchStatus("👉 Turn your face to the right to lock Step 3.");
          announce(warningMsg);
          speakText(warningMsg);
          return;
        }
        if (leftSim >= 0.86) {
          const warningMsg = "Please turn your face to the right to capture your right profile. Your face is still turned to the left.";
          setFaceErrorMessage("⚠️ Turn face to the RIGHT 👉. Left angle is already locked for Step 2. Please turn right.");
          setFaceMatchStatus("👉 Turn your face to the right to lock Step 3.");
          announce(warningMsg);
          speakText(warningMsg);
          return;
        }

        scannedExamFaceVectorsRef.current.right = liveVector;
        scannedAnglesStateRef.current.right = true;
        setScannedAnglesState(prev => ({ ...prev, right: true }));
        setScannedAnglesThumbs(prev => ({ ...prev, right: snapshotDataUrl }));

        scanStageRef.current = 'complete';
        setFaceScanStage('complete');
        setFaceScanProgress(100);
        setFaceDetecting(false);
        setFaceDetected(true);
        setIsFaceVerifiedForExam(true);
        setIsFacePresentInExam(true);
        setIsScannedStudentWriting(true);
        setIsOtherPersonDetected(false);
        setIsMultiplePeopleDetected(false);
        isScannedStudentWritingRef.current = true;

        if (scanIntervalRef.current) {
          clearInterval(scanIntervalRef.current);
          scanIntervalRef.current = null;
        }

        try {
          const existingLogs = JSON.parse(localStorage.getItem('shared_live_logs') || '[]');
          const updatedLog = {
            id: `log_${Date.now()}`,
            student: student.name,
            studentName: student.name,
            teacherEmail: pendingExamToStart?.teacherEmail || '',
            teacherName: pendingExamToStart?.teacherName || '',
            examId: pendingExamToStart?.id || pendingExamToStart?._id || '',
            examTitle: pendingExamToStart?.title || '',
            status: 'Multi-Angle Face Verified & Active',
            statusBadge: '🟢 Verified (All Angles): ' + student.name,
            started: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            remaining: '01:00:00',
            answered: `0 / ${(pendingExamToStart?.questions || []).length || 2}`,
            voice: 'Active (en-US)',
            submitted: 'No',
            faceVerified: true,
            facePresent: true,
            faceSnapshot: snapshotDataUrl || faceSnapshotUrl,
            multiAngleVerified: true
          };
          localStorage.setItem('shared_live_logs', JSON.stringify([updatedLog, ...existingLogs.filter(l => l.student !== student.name)]));
          window.dispatchEvent(new Event('storage'));
        } catch (e) {}

        const msg = `Multi-angle face scan confirmed for candidate ${student.name}. Biometric identity locked across center, left, and right angles. Entering exam now.`;
        announce(msg);
        speakText(msg, () => {
          setFaceAuthModalOpen(false);
          if (pendingExamToStart) {
            launchActualExam(pendingExamToStart);
          }
        });
      }
    } catch (e) {
      console.warn("Manual face pass error:", e);
    }
  };

  const handleCancelFaceAuth = () => {
    setFaceAuthModalOpen(false);
    stopCameraForFaceAuth();
    setPendingExamToStart(null);
    const cancelMsg = "Exam entry cancelled. Student face scanning is compulsory to begin any assessment.";
    announce(cancelMsg);
    speakText(cancelMsg);
  };

  // Helper to cleanly restart or reconnect the exam webcam if turned off or stream ended
  const restartProctorWebcam = async () => {
    try {
      let cur = mediaStreamRef.current;
      const track = cur?.getVideoTracks()?.[0];
      if (!cur || !cur.active || !track || track.readyState === 'ended') {
        if (cur) {
          try {
            cur.getTracks().forEach(t => t.stop());
          } catch (e) {}
        }
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          cur = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
            audio: false
          });
          mediaStreamRef.current = cur;
        }
      }
      if (proctorVideoRef.current && cur) {
        proctorVideoRef.current.srcObject = cur;
        await proctorVideoRef.current.play().catch(() => {});
      }
    } catch (e) {
      console.warn("Continuous proctor camera restart error:", e);
    }
  };

  // Continuous Face Proctoring Loop throughout the Active Exam Session (Monitors whether Scanned Student is Writing or Others)
  useEffect(() => {
    if (!currentExam || examSubmitted) {
      if (proctorScanIntervalRef.current) {
        clearInterval(proctorScanIntervalRef.current);
        proctorScanIntervalRef.current = null;
      }
      return;
    }

    let activeStream = mediaStreamRef.current;
    let lastCameraReconnectAttempt = 0;

    const setupProctorCamera = async () => {
      await restartProctorWebcam();
    };

    setupProctorCamera();

    // Start recurring live proctoring scan every 1200ms
    proctorScanIntervalRef.current = setInterval(async () => {
      try {
        if (!proctorVideoRef.current || !proctorCanvasRef.current) return;
      const video = proctorVideoRef.current;
      const canvas = proctorCanvasRef.current;

      const curStream = mediaStreamRef.current;
      const videoTrack = curStream?.getVideoTracks()?.[0];
      const isStreamLive = Boolean(
        curStream && 
        curStream.active && 
        videoTrack && 
        videoTrack.readyState === 'live' && 
        videoTrack.enabled && 
        !videoTrack.muted
      );

      const isVideoPlaying = Boolean(
        video &&
        video.readyState >= 2 && 
        !video.paused && 
        !video.ended && 
        (video.videoWidth || 0) > 0 && 
        (video.videoHeight || 0) > 0
      );

      canvas.width = (video && video.videoWidth) ? video.videoWidth : 320;
      canvas.height = (video && video.videoHeight) ? video.videoHeight : 240;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      let isBlackFrame = false;
      if (isVideoPlaying) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        try {
          const frameData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
          let lumSum = 0;
          let sampleCount = 0;
          let darkCount = 0;
          const step = Math.max(4, Math.floor(frameData.length / 4000));
          for (let p = 0; p < frameData.length; p += step * 4) {
            const lum = 0.299 * frameData[p] + 0.587 * frameData[p + 1] + 0.114 * frameData[p + 2];
            lumSum += lum;
            sampleCount++;
            if (lum < 12) darkCount++;
          }
          const avgLum = sampleCount > 0 ? (lumSum / sampleCount) : 0;
          isBlackFrame = (sampleCount > 0 && (darkCount / sampleCount) > 0.94) || avgLum < 6;
        } catch (e) {}
      }

      const isCameraOffNow = !isStreamLive || !isVideoPlaying || isBlackFrame;
      const now = Date.now();

      // PROCTORING EVALUATION: Check for Camera Off, Face Absence, Multiple People, or Face Mismatch
      let isViolation = false;
      let violationType = null;
      let violationTitle = '';
      let violationHeading = '';
      let violationMsg = '';
      let violationSpeech1 = '';
      let violationSpeech2 = '';
      let violationExitDetail = '';
      let violationTeacherStatus = '';
      let peopleCheck = { isPresent: false, isMultiple: false, count: 0, faces: [], primaryFaceBox: null };

      if (isCameraOffNow) {
        // CONDITION 0: CAMERA IS TURNED OFF / BLOCKED / NO VIDEO FEED
        if (now - lastCameraReconnectAttempt > 5000) {
          lastCameraReconnectAttempt = now;
          restartProctorWebcam();
        }
        isViolation = true;
        violationType = 'camera_off';
        violationTitle = 'EXAM WEBCAM TURNED OFF';
        violationHeading = 'Exam Camera is Turned Off!';
        violationMsg = `Your exam webcam is turned off, disabled, or blocked. Examination rules strictly require candidate ${student.name} to remain clearly visible to the camera at all times.`;
        violationSpeech1 = `Security Alert 1 of 2: Your exam camera is turned off! Please turn on your webcam immediately. Continuous camera monitoring is compulsory!`;
        violationSpeech2 = `Final warning. Alert 2 of 2: Your camera is turned off! Turn on your camera immediately, or your exam will be terminated!`;
        violationExitDetail = 'Exam webcam was repeatedly turned off or blocked during the examination';
        violationTeacherStatus = '🔴 CAMERA TURNED OFF: No Video Feed';

        setIsCameraOff(true);
        setIsFacePresentInExam(false);
        setIsMultiplePeopleDetected(false);
        isMultiplePeopleDetectedRef.current = false;
      } else {
        setIsCameraOff(false);

        try {
          peopleCheck = await detectPeopleInCanvas(canvas);
          const liveVector = extractBiometricFeaturesFromCanvas(canvas, peopleCheck.primaryFaceBox);
          const enrolledVector = enrolledFaceVectorRef.current;
          const scannedVectors = scannedExamFaceVectorsRef.current || {};
          const scannedCenter = scannedVectors.center || scannedExamFaceVectorRef.current;
          const scannedLeft = scannedVectors.left;
          const scannedRight = scannedVectors.right;

          let enrolledSim = 0;
          let simCenter = 0;
          let simLeft = 0;
          let simRight = 0;

          if (enrolledVector && liveVector) {
            enrolledSim = computeBiometricSimilarity(enrolledVector, liveVector);
          }
          if (scannedCenter && liveVector) {
            simCenter = computeBiometricSimilarity(scannedCenter, liveVector);
          }
          if (scannedLeft && liveVector) {
            simLeft = computeBiometricSimilarity(scannedLeft, liveVector);
          }
          if (scannedRight && liveVector) {
            simRight = computeBiometricSimilarity(scannedRight, liveVector);
          }

          // Multi-Angle Matching: Matches if ANY of Center, Left, or Right angle matches!
          const bestScannedSim = Math.max(simCenter, simLeft, simRight);
          const bestOverallSim = Math.max(bestScannedSim, enrolledSim);

          if (!peopleCheck.isPresent) {
            // CONDITION 1: SCANNED FACE IS NOT THERE (Candidate absent / looking away / left camera)
            isViolation = true;
            violationType = 'face_absent';
            violationTitle = 'SCANNED FACE NOT DETECTED';
            violationHeading = 'Candidate Face Missing from Camera!';
            violationMsg = `Your face is not visible to the exam camera. Please look directly into the camera. Only candidate ${student.name} is permitted to write this exam.`;
            violationSpeech1 = `Alert 1 of 2: Scanned face is not detected in camera. Please face the camera immediately. You have 1 warning remaining. On the 3rd violation, your exam will exit!`;
            violationSpeech2 = `Final warning. Alert 2 of 2: Scanned face is not detected! If your face is not back in the camera immediately, your exam will be terminated and exited!`;
            violationExitDetail = 'Scanned face was repeatedly not detected in the exam camera';
            violationTeacherStatus = '⚠️ Candidate Face Absent / Missing';

            setIsMultiplePeopleDetected(false);
            isMultiplePeopleDetectedRef.current = false;
            setIsFacePresentInExam(false);
          } else if (peopleCheck.isMultiple) {
            // CONDITION 2: OTHERS ARE THERE (Multiple people in camera)
            isViolation = true;
            violationType = 'multiple_people';
            violationTitle = 'MULTIPLE PEOPLE DETECTED';
            violationHeading = 'Multiple People in Camera View!';
            violationMsg = `Facial recognition proctoring detected ${peopleCheck.count} people in front of your camera. Examination rules strictly require candidate ${student.name} alone.`;
            violationSpeech1 = `Alert 1 of 2: Multiple people detected in camera! Only registered student ${student.name} is permitted to write this exam. Please ensure you are alone. On the 3rd violation, your exam will exit!`;
            violationSpeech2 = `Final warning. Alert 2 of 2: Multiple people detected in camera! If another person remains in view, your exam will be terminated and exited immediately!`;
            violationExitDetail = 'Other people were repeatedly detected in front of the camera';
            violationTeacherStatus = `🚨 MULTIPLE PEOPLE DETECTED (${peopleCheck.count} People)`;

            setIsMultiplePeopleDetected(true);
            isMultiplePeopleDetectedRef.current = true;
            setDetectedPeopleCount(peopleCheck.count);
            setIsFacePresentInExam(true);
          } else {
            // Exactly 1 person in camera: verify if it's the registered scanned student
            let isScannedStudentMatch = false;
            if (scannedCenter || scannedLeft || scannedRight || enrolledVector) {
              isScannedStudentMatch = Boolean(bestScannedSim >= 0.16 || bestOverallSim >= 0.16);
            } else {
              isScannedStudentMatch = true;
            }

            if (!isScannedStudentMatch) {
              // CONDITION 3: OTHERS ARE THERE (Unauthorized person / face mismatch)
              isViolation = true;
              violationType = 'face_mismatch';
              violationTitle = 'UNAUTHORIZED PERSON DETECTED';
              violationHeading = 'Unauthorized Person Detected!';
              violationMsg = `The person in front of the camera does not match scanned candidate ${student.name}. Only candidate ${student.name} is permitted to write this exam.`;
              violationSpeech1 = `Alert 1 of 2: Unauthorized person detected in camera. Only registered candidate ${student.name} is permitted to write this exam. On the 3rd violation, your exam will exit!`;
              violationSpeech2 = `Final warning. Alert 2 of 2: Unauthorized person detected! If candidate ${student.name} does not immediately resume alone, your exam will be terminated and exited immediately!`;
              violationExitDetail = 'An unauthorized face repeatedly attempted to write the exam instead of candidate ' + student.name;
              violationTeacherStatus = '🚨 FACE MISMATCH: Unauthorized Person Writing';

              setIsMultiplePeopleDetected(false);
              isMultiplePeopleDetectedRef.current = false;
              setIsFacePresentInExam(true);
            } else {
              // VERIFIED: Scanned student is writing alone!
              isViolation = false;
              consecutiveMultiplePeopleCountRef.current = 0;
              consecutiveMismatchTicksRef.current = 0;
              setIsCameraOff(false);
              setIsMultiplePeopleDetected(false);
              isMultiplePeopleDetectedRef.current = false;
              setDetectedPeopleCount(1);
              setIsScannedStudentWriting(true);
              setIsOtherPersonDetected(false);
              setIsFacePresentInExam(true);
              isScannedStudentWritingRef.current = true;

              if (faceMismatchActiveAlert || showMultiplePeopleWarningModal) {
                setFaceMismatchActiveAlert(null);
                setShowMultiplePeopleWarningModal(false);
                const resumeMsg = `Identity confirmed. Welcome back ${student.name}. Exam inputs and voice assistant unlocked.`;
                announce("🟢 " + resumeMsg);
                speakText(resumeMsg);
              }
            }
          }
        } catch (e) {
          console.warn("Continuous proctoring error:", e);
        }
      }

        // UNIFIED PROCTOR STRIKE CONTROLLER (Alerts 2 times, Exits from exam on 3rd time)
        if (isViolation) {
          consecutiveMismatchTicksRef.current++;

          // For camera_off or face_absent, lock inputs quickly (~2.4s) because candidate is not on camera!
          // For subtle face posture shifts, require sustained threshold (~6-7s)
          const lockTicks = (violationType === 'camera_off' || violationType === 'face_absent') ? 2 : 5;
          if (consecutiveMismatchTicksRef.current >= lockTicks) {
            setIsScannedStudentWriting(false);
            setIsOtherPersonDetected(true);
            isScannedStudentWritingRef.current = false;
          }

          // Sustained Violation & Alert Spacing:
          const timeSinceLastAlert = now - lastMismatchAlertTimeRef.current;
          const strikeCooldown = faceMismatchStrikeCountRef.current === 0 
            ? 0 
            : ((violationType === 'camera_off' || violationType === 'face_absent') ? 12000 : 20000);

          const minRequiredTicks = (violationType === 'camera_off' || violationType === 'face_absent') ? 3 : 6;
          if (consecutiveMismatchTicksRef.current >= minRequiredTicks && timeSinceLastAlert >= strikeCooldown) {
            lastMismatchAlertTimeRef.current = now;
            consecutiveMismatchTicksRef.current = 0;

              if (faceMismatchStrikeCountRef.current === 0) {
                // === ALERT 1 OF 2 ===
                faceMismatchStrikeCountRef.current = 1;
                setFaceMismatchStrikeCount(1);
                setFaceAbsentWarningsCount(1);

                announce("⚠️ " + violationSpeech1);
                speakText(violationSpeech1);

                setFaceMismatchActiveAlert({
                  strike: 1,
                  maxStrikes: 2,
                  type: violationType,
                  title: `⚠️ WARNING 1 OF 2: ${violationTitle}`,
                  heading: violationHeading,
                  message: violationMsg,
                  submessage: `Proctoring warning 1 of 2. You have 1 warning remaining. On the 3rd violation, your exam will automatically exit!`
                });

                try {
                  const existingLogs = JSON.parse(localStorage.getItem('shared_live_logs') || '[]');
                  const updatedLog = {
                    id: `log_${Date.now()}`,
                    student: student.name,
                    studentName: student.name,
                    teacherEmail: currentExam?.teacherEmail || '',
                    teacherName: currentExam?.teacherName || '',
                    examId: currentExam?.id || currentExam?._id || '',
                    examTitle: currentExam?.title || '',
                    status: `⚠️ ${violationTitle}: Warning 1 of 2 Issued`,
                    statusBadge: `🔴 ALERT 1/2: ${student.name}`,
                    started: '10:00 AM',
                    remaining: `${Math.floor(examTimeRemaining / 60)}m`,
                    answered: `${getExamQuestionsAnsweredCount(currentExam, studentAnswers, currentAnswerInput, currentQIndex)} / ${currentExam.questions.length}`,
                    voice: '🔒 Locked (Proctor Warning 1)',
                    submitted: 'No',
                    faceVerified: !isCameraOffNow,
                    facePresent: isCameraOffNow ? false : Boolean(peopleCheck.isPresent),
                    isOtherPerson: true,
                    isCameraOff: isCameraOffNow,
                    isFaceAbsent: (violationType === 'face_absent'),
                    isMultiplePeople: isCameraOffNow ? false : Boolean(peopleCheck.isMultiple),
                    strikeCount: 1
                  };
                  localStorage.setItem('shared_live_logs', JSON.stringify([updatedLog, ...existingLogs.filter(l => l.student !== student.name)]));
                  window.dispatchEvent(new Event('storage'));
                } catch (e) {}

              } else if (faceMismatchStrikeCountRef.current === 1) {
                // === ALERT 2 OF 2 (FINAL WARNING) ===
                faceMismatchStrikeCountRef.current = 2;
                setFaceMismatchStrikeCount(2);
                setFaceAbsentWarningsCount(2);

                announce("🚨 " + violationSpeech2);
                speakText(violationSpeech2);

                setFaceMismatchActiveAlert({
                  strike: 2,
                  maxStrikes: 2,
                  type: violationType,
                  title: `🚨 FINAL WARNING (ALERT 2 OF 2): ${violationTitle}`,
                  heading: violationHeading,
                  message: `CRITICAL MALPRACTICE WARNING: ${violationMsg}`,
                  submessage: `This is your FINAL warning. One more violation will immediately terminate and exit your exam to the dashboard!`
                });

                try {
                  const existingLogs = JSON.parse(localStorage.getItem('shared_live_logs') || '[]');
                  const updatedLog = {
                    id: `log_${Date.now()}`,
                    student: student.name,
                    studentName: student.name,
                    teacherEmail: currentExam?.teacherEmail || '',
                    teacherName: currentExam?.teacherName || '',
                    examId: currentExam?.id || currentExam?._id || '',
                    examTitle: currentExam?.title || '',
                    status: `🚨 ${violationTitle}: Final Warning 2 of 2 Issued`,
                    statusBadge: `🔴 FINAL WARNING 2/2: ${student.name}`,
                    started: '10:00 AM',
                    remaining: `${Math.floor(examTimeRemaining / 60)}m`,
                    answered: `${getExamQuestionsAnsweredCount(currentExam, studentAnswers, currentAnswerInput, currentQIndex)} / ${currentExam.questions.length}`,
                    voice: '🔒 Locked (Final Warning 2)',
                    submitted: 'No',
                    faceVerified: !isCameraOffNow,
                    facePresent: isCameraOffNow ? false : Boolean(peopleCheck.isPresent),
                    isOtherPerson: true,
                    isCameraOff: isCameraOffNow,
                    isFaceAbsent: (violationType === 'face_absent'),
                    isMultiplePeople: isCameraOffNow ? false : Boolean(peopleCheck.isMultiple),
                    strikeCount: 2
                  };
                  localStorage.setItem('shared_live_logs', JSON.stringify([updatedLog, ...existingLogs.filter(l => l.student !== student.name)]));
                  window.dispatchEvent(new Event('storage'));
                } catch (e) {}

              } else if (faceMismatchStrikeCountRef.current >= 2) {
                // === 3RD TIME: AUTO-TERMINATE & EXIT FROM EXAM ===
                faceMismatchStrikeCountRef.current = 3;
                setFaceMismatchStrikeCount(3);
                setFaceAbsentWarningsCount(3);

                if (proctorScanIntervalRef.current) {
                  clearInterval(proctorScanIntervalRef.current);
                  proctorScanIntervalRef.current = null;
                }

                stopCameraForFaceAuth();

                const exitMsg = `Exam session ended. You were alerted 2 times. 3 proctoring violations recorded: ${violationExitDetail}. Exiting exam session and returning to dashboard now.`;
                announce("⛔ " + exitMsg);
                speakText(exitMsg);

                const termExamTitle = currentExam?.title || 'Examination';
                try {
                  // Do NOT save as completed result in student_completed_results or shared_student_results!
                  // Retain live logs strictly for teacher proctor invigilation audit
                  const existingLogs = JSON.parse(localStorage.getItem('shared_live_logs') || '[]');
                  const termLog = {
                    id: `log_${Date.now()}`,
                    student: student.name,
                    studentName: student.name,
                    teacherEmail: currentExam?.teacherEmail || '',
                    teacherName: currentExam?.teacherName || '',
                    examId: currentExam?.id || currentExam?._id || '',
                    examTitle: termExamTitle,
                    status: `⛔ TERMINATED: 3 Proctoring Violations (${violationExitDetail})`,
                    statusBadge: '🔴 TERMINATED: ' + student.name,
                    started: '10:00 AM',
                    remaining: '00:00:00',
                    answered: `${getExamQuestionsAnsweredCount(currentExam, studentAnswers, currentAnswerInput, currentQIndex)} / ${currentExam.questions?.length || 2}`,
                    voice: '⛔ Terminated (Disqualified)',
                    submitted: 'Terminated',
                    isTerminated: true,
                    isCameraOff: isCameraOffNow
                  };
                  localStorage.setItem('shared_live_logs', JSON.stringify([termLog, ...existingLogs.filter(l => l.student !== student.name)]));
                  window.dispatchEvent(new Event('storage'));
                } catch (e) {}

                setFaceMismatchActiveAlert(null);
                setShowMultiplePeopleWarningModal(false);

                setExamTerminationModal({
                  studentName: student.name,
                  examTitle: termExamTitle,
                  reason: `3 Proctoring Violations: ${violationExitDetail}`,
                  alert1Reason: violationTitle,
                  alert2Reason: violationTitle,
                  details: `During this exam session, you received 2 warnings for proctoring violations (${violationExitDetail}). On the 3rd violation, as per strict automated proctoring rules, your exam session was automatically ended and closed without submission. You have been returned to the dashboard.`
                });

                setCurrentExam(null);
                setExamSubmitted(false);
                setIsExamActive(false);
                setCurrentAnswerInput('');
                setStudentAnswers({});
                setActiveTab('Dashboard');
              }
            }
          }
      } catch (e) {}
    }, 600);

    return () => {
      if (proctorScanIntervalRef.current) {
        clearInterval(proctorScanIntervalRef.current);
        proctorScanIntervalRef.current = null;
      }
    };
  }, [currentExam, examSubmitted, student, examTimeRemaining, studentAnswers]);

  // Cleanly exit an ongoing exam session without recording any completed exam results
  const handleExitExamWithoutSubmitting = (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (e && e.preventDefault) e.preventDefault();
    try {
      stopCameraForFaceAuth();
    } catch (err) {}
    if (proctorScanIntervalRef.current) {
      clearInterval(proctorScanIntervalRef.current);
      proctorScanIntervalRef.current = null;
    }
    if (examAnswerSilenceTimerRef.current) {
      clearTimeout(examAnswerSilenceTimerRef.current);
      examAnswerSilenceTimerRef.current = null;
    }
    if (examAnswerRecognitionRef.current) {
      try {
        examAnswerRecognitionRef.current.onstart = null;
        examAnswerRecognitionRef.current.onresult = null;
        examAnswerRecognitionRef.current.onerror = null;
        examAnswerRecognitionRef.current.onend = null;
        examAnswerRecognitionRef.current.abort();
      } catch (err) {}
      examAnswerRecognitionRef.current = null;
    }
    // Clean up recognition
    if (examAnswerRecognitionRef.current) {
      try {
        examAnswerRecognitionRef.current.abort();
      } catch (err) {}
      examAnswerRecognitionRef.current = null;
    }
    try {
      cancelSpeech();
    } catch (err) {}
    setIsDictatingExamAnswer(false);
    setLiveExamAnswerTranscript('');
    setFaceMismatchStrikeCount(0);
    faceMismatchStrikeCountRef.current = 0;
    consecutiveMismatchTicksRef.current = 0;
    lastMismatchAlertTimeRef.current = 0;
    setFaceMismatchActiveAlert(null);
    setShowMultiplePeopleWarningModal(false);
    setExamTerminationModal(null);
    setCurrentExam(null);
    setExamSubmitted(false);
    setIsExamActive(false);
    setCurrentAnswerInput('');
    setStudentAnswers({});
    setActiveTab('Dashboard');

    // Cleanly remove from active live examinee logs upon exit
    try {
      const sName = studentProfile?.name || student?.name || 'Examinee';
      const existingLogs = JSON.parse(localStorage.getItem('shared_live_logs') || '[]');
      const cleaned = existingLogs.filter(l => l && l.student !== sName);
      localStorage.setItem('shared_live_logs', JSON.stringify(cleaned));
      window.dispatchEvent(new Event('storage'));
    } catch (e) {}

    const exitMsg = "Exam session exited. You have returned to the dashboard. No answers were submitted.";
    announce(exitMsg);
    speakText(exitMsg);
  };

  // Start an Exam (Protected by Compulsory Face Verification)
  const startExamHandler = (exam) => {
    if (!exam) {
      const msg = "No active exam scheduled by your teacher is available yet.";
      announce(msg);
      speakText(msg);
      return;
    }

    // Auto-align activeSubject if starting a personalized exam in a different subject
    if (exam.subject && !isSubjectMatching(exam.subject, activeSubject)) {
      setActiveSubject(exam.subject);
      try {
        localStorage.setItem('student_selected_subject', exam.subject);
      } catch (e) {}
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const isFuture = (exam.status === 'Scheduled') && exam.date && exam.date !== 'Upcoming' && exam.date > todayStr;
    if (isFuture) {
      const msg = `${exam.title} is scheduled for ${formatDateForVoice(exam.date)}. It will become active on that date.`;
      announce(msg);
      speakText(msg);
      return;
    }

    // Compulsory Face Verification Gate
    if (!isFaceVerifiedForExam) {
      startCameraForFaceAuth(exam);
      return;
    }

    launchActualExam(exam);
  };

  const launchActualExam = (exam) => {
    let allocatedMinutes = (exam.durationMinutes || exam.duration || 60);
    try {
      const perStudentRaw = localStorage.getItem('shared_student_extra_time');
      if (perStudentRaw) {
        const perStudentList = JSON.parse(perStudentRaw);
        const sName = (studentProfile.name || '').toLowerCase();
        const match = perStudentList.find(s => 
          (s.studentName && sName && s.studentName.toLowerCase().includes(sName)) ||
          (sName && s.studentName && sName.includes(s.studentName.toLowerCase()))
        );
        if (match && match.totalMinutes) {
          allocatedMinutes = match.totalMinutes;
        }
      }
    } catch (e) {}

    setIsExamActive(true);
    setCurrentExam(exam);
    setCurrentQIndex(0);
    setCurrentAnswerInput('');
    setStudentAnswers({});
    currentAnswerInputRef.current = '';
    lastSpokenExamAnswerRef.current = '';
    setFaceMismatchStrikeCount(0);
    faceMismatchStrikeCountRef.current = 0;
    consecutiveMismatchTicksRef.current = 0;
    lastMismatchAlertTimeRef.current = 0;
    setFaceMismatchActiveAlert(null);
    setExamTerminationModal(null);
    setIsScannedStudentWriting(true);
    setIsOtherPersonDetected(false);
    isScannedStudentWritingRef.current = true;
    setExamSubmitted(false);
    setExamTimeRemaining(allocatedMinutes * 60);
    setActiveTab('AI Exam Assistant');
    hasAnnouncedExamTabRef.current = true;

    // Immediately register active examinee in shared_live_logs for Teacher Dashboard monitoring
    try {
      const sName = studentProfile?.name || student?.name || 'Examinee';
      const sEmail = studentProfile?.email || student?.email || '';
      const startLog = {
        id: `log_${exam.id || exam._id || Date.now()}`,
        student: sName,
        studentName: sName,
        studentEmail: sEmail,
        teacherEmail: exam.teacherEmail || exam.creatorEmail || '',
        teacherName: exam.teacherName || '',
        examId: exam.id || exam._id || '',
        examTitle: exam.title || 'Theory Assessment',
        subject: exam.subject || 'Computer Science',
        status: '🟢 Writing',
        statusBadge: '🟢 Writing: ' + sName,
        started: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        start: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        remaining: `${allocatedMinutes}m 00s`,
        answered: `0 / ${(exam.questions || []).length || 1}`,
        voice: 'Active (Voice Dictation)',
        submitted: 'No',
        faceVerified: true,
        facePresent: true,
        isOtherPerson: false,
        isMultiplePeople: false,
        timestamp: Date.now()
      };
      const existingLogs = JSON.parse(localStorage.getItem('shared_live_logs') || '[]');
      const filtered = existingLogs.filter(l => l && l.student !== sName && l.studentEmail !== sEmail);
      localStorage.setItem('shared_live_logs', JSON.stringify([startLog, ...filtered]));
      window.dispatchEvent(new Event('storage'));
    } catch (e) {
      console.warn("Live monitoring initial log error:", e);
    }
    
    const instructions = String(exam.instructions || exam.description || "Read and answer each question carefully using voice navigation.").trim();
    const startMsg = `Welcome to ${exam.title}. Exam instructions: ${instructions}. Total ${exam.questions ? exam.questions.length : 0} questions. Let us begin.`;
    handleReadExamQuestionStepByStep(0, startMsg);
  };

  const currentAnswerInputRef = useRef('');
  const lastSpokenExamAnswerRef = useRef('');

  const updateCurrentAnswer = (newAnswer) => {
    currentAnswerInputRef.current = newAnswer;
    setCurrentAnswerInput(newAnswer);
    if (currentExam) {
      const q = currentExam.questions?.[currentQIndex];
      const qId = q && q.id !== undefined ? q.id : currentQIndex + 1;
      setStudentAnswers(prev => ({
        ...prev,
        [`${currentExam.id}-${currentQIndex}`]: newAnswer,
        [`${currentExam._id || currentExam.id}-${currentQIndex}`]: newAnswer,
        [currentQIndex]: newAnswer,
        [`q_${currentQIndex}`]: newAnswer,
        [`${qId}`]: newAnswer,
        [`q_${qId}`]: newAnswer
      }));
    }
  };

  // Inline Question Answer Voice Dictation & Read Aloud Handlers
  const handleFinishExamAnswerDictation = (finalAnswer) => {
    setIsDictatingExamAnswer(false);
    setLiveExamAnswerTranscript('');
    if (examAnswerSilenceTimerRef.current) {
      clearTimeout(examAnswerSilenceTimerRef.current);
      examAnswerSilenceTimerRef.current = null;
    }
    const clean = String(finalAnswer || currentAnswerInputRef.current || currentAnswerInput || '').trim();
    if (clean) {
      updateCurrentAnswer(clean);
      lastSpokenExamAnswerRef.current = clean;
      announce(`✅ Recorded Answer: "${clean}"`);
      const promptText = `You answered: "${clean}". Say your command: repeat answer, or to say answer again, or next question, or repeat question, or submit.`;
      speakText(promptText);
    } else {
      announce("No speech detected for answer.");
      speakText("No speech was detected. Tap Answer by Voice to record your answer.");
    }
  };

  const handleExamTextareaBlur = () => {
    const clean = String(currentAnswerInputRef.current || currentAnswerInput || '').trim();
    if (clean && clean !== lastSpokenExamAnswerRef.current && !isDictatingExamAnswer) {
      lastSpokenExamAnswerRef.current = clean;
      const promptText = `You answered: "${clean}". Say your command: repeat answer, or to say answer again, or next question, or repeat question, or submit.`;
      announce(`✅ Recorded Answer: "${clean}"`);
      speakText(promptText);
    }
  };

  const handleExamTextareaKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const clean = String(currentAnswerInputRef.current || currentAnswerInput || '').trim();
      if (clean) {
        lastSpokenExamAnswerRef.current = clean;
        const promptText = `You answered: "${clean}". Say your command: repeat answer, or to say answer again, or next question, or repeat question, or submit.`;
        announce(`✅ Recorded Answer: "${clean}"`);
        speakText(promptText);
      }
    }
  };

  const handleStopExamAnswerDictation = () => {
    if (examAnswerRecognitionRef.current) {
      try {
        examAnswerRecognitionRef.current.onstart = null;
        examAnswerRecognitionRef.current.onresult = null;
        examAnswerRecognitionRef.current.onerror = null;
        examAnswerRecognitionRef.current.onend = null;
        examAnswerRecognitionRef.current.stop();
      } catch (e) {}
      examAnswerRecognitionRef.current = null;
    }
    setIsDictatingExamAnswer(false);
    if (examAnswerSilenceTimerRef.current) {
      clearTimeout(examAnswerSilenceTimerRef.current);
      examAnswerSilenceTimerRef.current = null;
    }
    const currentAns = (currentAnswerInput || liveExamAnswerTranscript || '').trim();
    handleFinishExamAnswerDictation(currentAns);
  };

  const handleStartExamAnswerDictation = async () => {
    if (!isVoiceAssistantEnabled) {
      announce("⚠️ Voice Assistant is disabled. Enable it from the top header.");
      return;
    }

    // Security Gate: Check face proctoring
    if (currentExam && !examSubmitted) {
      if (!isScannedStudentWritingRef.current || isOtherPersonDetected || isMultiplePeopleDetectedRef.current) {
        const lockMsg = isMultiplePeopleDetectedRef.current
          ? `Voice answer locked. Multiple people detected in front of camera. Only candidate ${student.name} may speak.`
          : `Voice answer locked. Unrecognized person detected. Only candidate ${student.name} may speak.`;
        announce("🔒 Voice Answer Locked: Proctor Alert");
        speakText(lockMsg);
        return;
      }
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      announce("Speech recognition is not supported in this browser.");
      speakText("Speech recognition is not supported in this browser. Please use Google Chrome or Microsoft Edge.");
      return;
    }

    // Cancel any existing TTS
    cancelSpeech();

    // Request mic permission
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (e) {}
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      let recognizedAccumulated = currentAnswerInput ? currentAnswerInput + ' ' : '';
      let sessionSpoken = '';

      const resetSilenceTimer = () => {
        if (examAnswerSilenceTimerRef.current) {
          clearTimeout(examAnswerSilenceTimerRef.current);
        }
        examAnswerSilenceTimerRef.current = setTimeout(() => {
          handleStopExamAnswerDictation();
        }, 4000);
      };

      recognition.onstart = () => {
        setIsDictatingExamAnswer(true);
        setLiveExamAnswerTranscript('');
        announce('🎙️ Listening for your answer... Speak clearly. Say "DONE" when finished.');
        resetSilenceTimer();
      };

      recognition.onresult = (event) => {
        resetSilenceTimer();
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcriptChunk = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            sessionSpoken += ' ' + transcriptChunk;
          } else {
            interim += transcriptChunk;
          }
        }

        const combinedSession = (sessionSpoken + ' ' + interim).trim();
        setLiveExamAnswerTranscript(combinedSession);

        const lowerCombined = combinedSession.toLowerCase();
        const currentQ = currentExam?.questions?.[currentQIndex];

        // 1. Repeat Answer Command: if candidate asks to repeat their answer or try again
        if (/\b(repeat answer|repeat my answer|re-record|change answer|try again)\b/i.test(lowerCombined) || (lowerCombined === 'repeat' && currentAnswerInput)) {
          try { recognition.stop(); } catch (e) {}
          setIsDictatingExamAnswer(false);
          if (examAnswerSilenceTimerRef.current) {
            clearTimeout(examAnswerSilenceTimerRef.current);
            examAnswerSilenceTimerRef.current = null;
          }
          updateCurrentAnswer('');
          setLiveExamAnswerTranscript('');
          speakText("Clearing previous answer. Please speak your answer again now.", () => {
            setTimeout(() => {
              handleStartExamAnswerDictation();
            }, 300);
          });
          return;
        }

        // 2. Navigation Commands during exam dictation
        if (/\b(next question|save and next|go to next|next q|proceed)\b/i.test(lowerCombined) || lowerCombined === 'next' || lowerCombined === 'next question') {
          try { recognition.stop(); } catch (e) {}
          setIsDictatingExamAnswer(false);
          if (examAnswerSilenceTimerRef.current) {
            clearTimeout(examAnswerSilenceTimerRef.current);
            examAnswerSilenceTimerRef.current = null;
          }
          handleSaveAndNext();
          return;
        }

        if (/\b(previous question|go back|back question)\b/i.test(lowerCombined) || lowerCombined === 'previous') {
          try { recognition.stop(); } catch (e) {}
          setIsDictatingExamAnswer(false);
          if (examAnswerSilenceTimerRef.current) {
            clearTimeout(examAnswerSilenceTimerRef.current);
            examAnswerSilenceTimerRef.current = null;
          }
          handlePreviousQ();
          return;
        }

        if (/\b(exit exam|cancel exam|quit exam|leave exam)\b/i.test(lowerCombined)) {
          try { recognition.stop(); } catch (e) {}
          setIsDictatingExamAnswer(false);
          if (examAnswerSilenceTimerRef.current) {
            clearTimeout(examAnswerSilenceTimerRef.current);
            examAnswerSilenceTimerRef.current = null;
          }
          handleExitExamWithoutSubmitting();
          return;
        }

        if (/\b(submit exam|finish exam)\b/i.test(lowerCombined)) {
          try { recognition.stop(); } catch (e) {}
          setIsDictatingExamAnswer(false);
          if (examAnswerSilenceTimerRef.current) {
            clearTimeout(examAnswerSilenceTimerRef.current);
            examAnswerSilenceTimerRef.current = null;
          }
          handleSubmitExam();
          return;
        }

        if (/\b(repeat question|read question|read the question|say question)\b/i.test(lowerCombined) || (lowerCombined === 'repeat' && !currentAnswerInput)) {
          try { recognition.stop(); } catch (e) {}
          setIsDictatingExamAnswer(false);
          if (examAnswerSilenceTimerRef.current) {
            clearTimeout(examAnswerSilenceTimerRef.current);
            examAnswerSilenceTimerRef.current = null;
          }
          handleReadExamQuestionStepByStep(currentQIndex);
          return;
        }

        // 2. MCQ Option Commands
        if (currentQ?.options && currentQ.options.length > 0) {
          let matchedOption = null;
          if (/\b(option a|choice a|select a|first option)\b/i.test(lowerCombined) || lowerCombined === 'a' || lowerCombined === 'option 1') {
            matchedOption = currentQ.options[0];
          } else if (/\b(option b|choice b|select b|second option)\b/i.test(lowerCombined) || lowerCombined === 'b' || lowerCombined === 'option 2') {
            matchedOption = currentQ.options[1];
          } else if (/\b(option c|choice c|select c|third option)\b/i.test(lowerCombined) || lowerCombined === 'c' || lowerCombined === 'option 3') {
            matchedOption = currentQ.options[2];
          } else if (/\b(option d|choice d|select d|fourth option)\b/i.test(lowerCombined) || lowerCombined === 'd' || lowerCombined === 'option 4') {
            matchedOption = currentQ.options[3];
          } else {
            for (const opt of currentQ.options) {
              const optLower = opt.toLowerCase();
              if (lowerCombined.includes(optLower) || (optLower.length > 8 && lowerCombined.includes(optLower.slice(0, 15)))) {
                matchedOption = opt;
                break;
              }
            }
          }

          if (matchedOption) {
            updateCurrentAnswer(matchedOption);
            try { recognition.stop(); } catch (e) {}
            setIsDictatingExamAnswer(false);
            if (examAnswerSilenceTimerRef.current) {
              clearTimeout(examAnswerSilenceTimerRef.current);
              examAnswerSilenceTimerRef.current = null;
            }
            const isLastQ = currentExam && currentQIndex >= currentExam.questions.length - 1;
            const promptText = isLastQ
              ? `You selected: "${matchedOption}". Would you like to repeat your answer, or say 'Submit Exam' to finish?`
              : `You selected: "${matchedOption}". Would you like to repeat your answer, or say 'Next Question' to save and proceed?`;
            speakText(promptText, () => {
              setTimeout(() => {
                handleStartExamAnswerDictation();
              }, 400);
            });
            return;
          }
        }

        // 3. Check if examinee said "done", "finish", "finished", "stop"
        if (/\b(done|finish|finished|stop recording|complete|completed)\b/i.test(lowerCombined)) {
          const cleanedFinal = (recognizedAccumulated + ' ' + combinedSession)
            .replace(/\b(done|finish|finished|stop recording|complete|completed)\b/gi, '')
            .replace(/\s+/g, ' ')
            .trim();
          updateCurrentAnswer(cleanedFinal);
          try { recognition.stop(); } catch (e) {}
          handleFinishExamAnswerDictation(cleanedFinal);
          return;
        }

        const fullCurrent = (recognizedAccumulated + ' ' + combinedSession).replace(/\s+/g, ' ').trim();
        updateCurrentAnswer(fullCurrent);
      };

      recognition.onerror = (event) => {
        console.warn('Exam answer speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          announce("Microphone access denied.");
          speakText("Microphone permission denied. Please allow microphone in browser settings.");
        }
        setIsDictatingExamAnswer(false);
      };

      recognition.onend = () => {
        setIsDictatingExamAnswer(false);
        examAnswerRecognitionRef.current = null;
        const finalAns = (sessionSpoken || currentAnswerInputRef.current || currentAnswerInput || liveExamAnswerTranscript || '').trim();
        if (finalAns && finalAns !== lastSpokenExamAnswerRef.current) {
          lastSpokenExamAnswerRef.current = finalAns;
          handleFinishExamAnswerDictation(finalAns);
        }
      };

      examAnswerRecognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('Error starting answer recognition:', err);
      setIsDictatingExamAnswer(false);
    }
  };

  const handleToggleExamAnswerDictation = () => {
    if (isDictatingExamAnswer) {
      handleStopExamAnswerDictation();
    } else {
      handleStartExamAnswerDictation();
    }
  };

  const handleReadCurrentAnswerAloud = () => {
    if (!isVoiceAssistantEnabled) {
      announce("Voice Assistant is disabled. Enable it from the top header.");
      return;
    }
    const clean = String(currentAnswerInputRef.current || currentAnswerInput || '').trim();
    if (!clean) {
      const msg = `Question ${currentQIndex + 1} has no answer recorded yet. You can type or tap Answer by Voice to speak your response.`;
      announce("ℹ️ No answer recorded yet.");
      speakText(msg);
    } else {
      lastSpokenExamAnswerRef.current = clean;
      const msg = `You entered: "${clean}". Would you like to repeat your answer, or proceed to the next question?`;
      announce(`🔊 Reading Recorded Answer: "${clean}"`);
      speakText(msg);
    }
  };

  // Step-by-Step Question Narration with Options & Automatic Voice Listening
  const handleReadExamQuestionStepByStep = (qIdx = currentQIndex, prefix = "") => {
    if (!currentExam || !currentExam.questions) return;
    const qList = currentExam.questions;
    if (qIdx < 0 || qIdx >= qList.length) return;
    const q = qList[qIdx];
    const totalQ = qList.length;
    const promptText = q?.text || q?.questionText || '';
    const options = q?.options || [];

    let speech = prefix ? `${prefix} ` : "";
    speech += `Question ${qIdx + 1} of ${totalQ}: ${promptText}. `;

    if (options && options.length > 0) {
      speech += `Options are: `;
      options.forEach((opt, idx) => {
        const letter = String.fromCharCode(65 + idx);
        speech += `Option ${letter}: ${opt}. `;
      });
      speech += `Tap Answer by Voice or select an option to answer.`;
    } else {
      speech += `Tap Answer by Voice or tap the answer box to speak your answer.`;
    }

    announce(`📖 Question ${qIdx + 1} of ${totalQ}: ${promptText}`);
    // Listen ONLY when student taps: do not auto-start microphone!
    speakText(speech);
  };

  // Exam navigation with synchronized answer persistence & voice feedback
  const handleSaveAndNext = () => {
    if (!currentExam) return;
    const q = currentExam.questions?.[currentQIndex];
    const qId = q && q.id !== undefined ? q.id : currentQIndex + 1;

    const savedAns = String(currentAnswerInputRef.current || currentAnswerInput || '').trim();
    const updatedAnswers = {
      ...studentAnswers,
      [`${currentExam.id}-${currentQIndex}`]: savedAns,
      [`${currentExam._id || currentExam.id}-${currentQIndex}`]: savedAns,
      [currentQIndex]: savedAns,
      [`q_${currentQIndex}`]: savedAns,
      [`${qId}`]: savedAns,
      [`q_${qId}`]: savedAns
    };
    setStudentAnswers(updatedAnswers);

    if (currentQIndex < currentExam.questions.length - 1) {
      const nextIndex = currentQIndex + 1;
      setCurrentQIndex(nextIndex);
      const nextQ = currentExam.questions[nextIndex];
      const nextQId = nextQ && nextQ.id !== undefined ? nextQ.id : nextIndex + 1;
      
      const existingNextAns = updatedAnswers[`${currentExam.id}-${nextIndex}`]
        || updatedAnswers[`${currentExam._id || currentExam.id}-${nextIndex}`]
        || updatedAnswers[nextIndex]
        || updatedAnswers[`q_${nextIndex}`]
        || updatedAnswers[`${nextQId}`]
        || updatedAnswers[`q_${nextQId}`]
        || '';
        
      setCurrentAnswerInput(existingNextAns);
      currentAnswerInputRef.current = existingNextAns;
      lastSpokenExamAnswerRef.current = existingNextAns;

      const prefix = savedAns 
        ? `Your answer was: "${savedAns}". Answer saved. Moving to Question ${nextIndex + 1}.` 
        : `Moving to Question ${nextIndex + 1}.`;
      handleReadExamQuestionStepByStep(nextIndex, prefix);
    } else {
      const lastMsg = savedAns
        ? `Your answer was: "${savedAns}". Answer saved. You are on the last question of the exam. You can say Submit Exam when ready to finish.`
        : "You are on the last question of the exam. You can say Submit Exam when ready to finish.";
      speakText(lastMsg);
    }
  };

  const handlePreviousQ = () => {
    if (!currentExam || currentQIndex <= 0) return;
    const q = currentExam.questions?.[currentQIndex];
    const qId = q && q.id !== undefined ? q.id : currentQIndex + 1;

    const updatedAnswers = {
      ...studentAnswers,
      [`${currentExam.id}-${currentQIndex}`]: currentAnswerInput,
      [`${currentExam._id || currentExam.id}-${currentQIndex}`]: currentAnswerInput,
      [currentQIndex]: currentAnswerInput,
      [`q_${currentQIndex}`]: currentAnswerInput,
      [`${qId}`]: currentAnswerInput,
      [`q_${qId}`]: currentAnswerInput
    };
    setStudentAnswers(updatedAnswers);

    const prevIndex = currentQIndex - 1;
    setCurrentQIndex(prevIndex);
    const prevQ = currentExam.questions[prevIndex];
    const prevQId = prevQ && prevQ.id !== undefined ? prevQ.id : prevIndex + 1;

    const existingPrevAns = updatedAnswers[`${currentExam.id}-${prevIndex}`]
      || updatedAnswers[`${currentExam._id || currentExam.id}-${prevIndex}`]
      || updatedAnswers[prevIndex]
      || updatedAnswers[`q_${prevIndex}`]
      || updatedAnswers[`${prevQId}`]
      || updatedAnswers[`q_${prevQId}`]
      || '';

    setCurrentAnswerInput(existingPrevAns);
    handleReadExamQuestionStepByStep(prevIndex, "Moving back.");
  };

  const handleJumpToQuestion = (targetIdx) => {
    if (!currentExam || targetIdx < 0 || targetIdx >= currentExam.questions.length) return;
    const q = currentExam.questions?.[currentQIndex];
    const qId = q && q.id !== undefined ? q.id : currentQIndex + 1;

    const updatedAnswers = {
      ...studentAnswers,
      [`${currentExam.id}-${currentQIndex}`]: currentAnswerInput,
      [`${currentExam._id || currentExam.id}-${currentQIndex}`]: currentAnswerInput,
      [currentQIndex]: currentAnswerInput,
      [`q_${currentQIndex}`]: currentAnswerInput,
      [`${qId}`]: currentAnswerInput,
      [`q_${qId}`]: currentAnswerInput
    };
    setStudentAnswers(updatedAnswers);

    setCurrentQIndex(targetIdx);
    const targetQ = currentExam.questions[targetIdx];
    const targetQId = targetQ && targetQ.id !== undefined ? targetQ.id : targetIdx + 1;

    const existingAns = updatedAnswers[`${currentExam.id}-${targetIdx}`]
      || updatedAnswers[`${currentExam._id || currentExam.id}-${targetIdx}`]
      || updatedAnswers[targetIdx]
      || updatedAnswers[`q_${targetIdx}`]
      || updatedAnswers[`${targetQId}`]
      || updatedAnswers[`q_${targetQId}`]
      || '';

    setCurrentAnswerInput(existingAns);
    handleReadExamQuestionStepByStep(targetIdx, `Jumping to Question ${targetIdx + 1}.`);
  };

  // Entrance hook: when candidate enters the exam page/feature, start step by step
  const hasAnnouncedExamTabRef = useRef(false);
  useEffect(() => {
    if (activeTab === 'AI Exam Assistant' && currentExam && !examSubmitted) {
      if (!hasAnnouncedExamTabRef.current) {
        hasAnnouncedExamTabRef.current = true;
        const timer = setTimeout(() => {
          const instructions = String(currentExam.instructions || currentExam.description || "Read and answer each question carefully using voice navigation.").trim();
          handleReadExamQuestionStepByStep(currentQIndex, `Welcome to ${currentExam.title}. Exam instructions: ${instructions}. Total ${currentExam.questions ? currentExam.questions.length : 0} questions. Let us begin.`);
        }, 500);
        return () => clearTimeout(timer);
      }
    } else if (activeTab !== 'AI Exam Assistant') {
      hasAnnouncedExamTabRef.current = false;
    }
  }, [activeTab, currentExam, examSubmitted]);

  // Real-time live synchronization hook with Teacher Dashboard
  useEffect(() => {
    let isMounted = true;

    const syncFromTeacher = () => {
      // 1. Read teacher-created exams & question banks from shared localStorage and MongoDB API
      const teacherMap = new Map();

      const sharedExamsRaw = localStorage.getItem('shared_exams');
      if (sharedExamsRaw) {
        try {
          const parsed = JSON.parse(sharedExamsRaw);
          if (Array.isArray(parsed)) {
            const rawSavedExams = parsed.filter(ex => {
              const examId = String(ex._id || ex.id || '');
              const titleStr = String(ex.title || ex.examTitle || '').toLowerCase();
              if (examId === 'ex_1' || examId === 'ex_2' || examId === 'ex_3' || examId === 'ex_4') return false;
              if (examId.startsWith('mock-') || examId.includes('bank-exam')) return false;
              if (titleStr.includes('operating systems & deadlocks') || titleStr.includes('ai & machine learning foundations')) return false;
              if (titleStr.includes('network security & web assistive systems') && examId.startsWith('mock-')) return false;
              return true;
            });
            const cleanSavedExams = deduplicateExamsList(rawSavedExams);
            if (cleanSavedExams.length !== parsed.length) {
              localStorage.setItem('shared_exams', JSON.stringify(cleanSavedExams));
            }

            cleanSavedExams.forEach((rawEx, idx) => {
              const ex = (rawEx && rawEx.data && typeof rawEx.data === 'object' && !Array.isArray(rawEx.data)) ? { ...rawEx.data, ...rawEx } : rawEx;
              if (!ex) return;
              const semKey = `${String(ex.title || ex.examTitle || 'Theory Assessment').trim().toLowerCase()}::${String(ex.subject || 'Computer Science').trim().toLowerCase()}::${String(ex.targetStudentEmail || '').trim().toLowerCase()}`;
              const examId = String(ex._id || ex.id || `teacher-exam-${idx}`);
              const existing = teacherMap.get(semKey) || {};
              teacherMap.set(semKey, {
                id: examId,
                _id: examId,
                examId: examId,
                title: ex.title || ex.examTitle || 'Theory Assessment',
                subject: ex.subject || 'Computer Science',
                teacherEmail: ex.teacherEmail || ex.creatorEmail || existing.teacherEmail || '',
                creatorEmail: ex.creatorEmail || ex.teacherEmail || existing.creatorEmail || '',
                teacherName: ex.teacherName || ex.teacher || existing.teacherName || '',
                targetStudentEmail: ex.targetStudentEmail || '',
                targetStudentName: ex.targetStudentName || '',
                assignedStudents: Array.isArray(ex.assignedStudents) ? ex.assignedStudents : (ex.targetStudentEmail ? [ex.targetStudentEmail] : []),
                date: ex.date || 'Upcoming',
                time: ex.time || ex.startTime || '10:00 AM',
                startTime: ex.startTime || ex.time || '10:00 AM',
                endTime: ex.endTime || '',
                duration: `${ex.duration || ex.durationMinutes || 60} min`,
                durationMinutes: Number(ex.duration || ex.durationMinutes || 60),
                status: ex.status || 'Published',
                instructions: ex.instructions || 'Read all theory questions carefully.',
                questions: (ex.questions && ex.questions.length > 0)
                  ? ex.questions.map((q, qIdx) => ({
                      id: q.id || q._id || qIdx + 1,
                      text: q.text || q.questionText || '',
                      type: q.type || q.questionType || 'Descriptive Theory',
                      options: q.options || [],
                      correctAnswer: q.correctAnswer || '',
                      marks: q.marks || 2
                    }))
                  : (existing.questions || [])
              });
            });
          }
        } catch (e) {}
      }

      fetchExams()
        .then(backendExams => {
          if (isMounted && Array.isArray(backendExams)) {
            const rawBackend = backendExams.filter(ex => {
              const examId = String(ex._id || ex.id || '');
              const titleStr = String(ex.title || ex.examTitle || '').toLowerCase();
              if (examId === 'ex_1' || examId === 'ex_2' || examId === 'ex_3' || examId === 'ex_4') return false;
              if (examId.startsWith('mock-') || examId.includes('bank-exam')) return false;
              if (titleStr.includes('operating systems & deadlocks') || titleStr.includes('ai & machine learning foundations')) return false;
              return true;
            });
            const cleanBackend = deduplicateExamsList(rawBackend);

            cleanBackend.forEach((rawEx, idx) => {
              const ex = (rawEx && rawEx.data && typeof rawEx.data === 'object' && !Array.isArray(rawEx.data)) ? { ...rawEx.data, ...rawEx } : rawEx;
              if (!ex) return;
              const semKey = `${String(ex.title || ex.examTitle || 'Theory Assessment').trim().toLowerCase()}::${String(ex.subject || 'Computer Science').trim().toLowerCase()}::${String(ex.targetStudentEmail || '').trim().toLowerCase()}`;
              const existing = teacherMap.get(semKey) || {};
              const examId = String(ex._id || ex.id || existing.id || `teacher-exam-${idx}`);

              teacherMap.set(semKey, {
                id: examId,
                _id: examId,
                examId: examId,
                title: ex.title || ex.examTitle || 'Theory Assessment',
                subject: ex.subject || 'Computer Science',
                teacherEmail: ex.teacherEmail || ex.creatorEmail || existing.teacherEmail || '',
                creatorEmail: ex.creatorEmail || ex.teacherEmail || existing.creatorEmail || '',
                teacherName: ex.teacherName || ex.teacher || existing.teacherName || '',
                targetStudentEmail: ex.targetStudentEmail || '',
                targetStudentName: ex.targetStudentName || '',
                assignedStudents: Array.isArray(ex.assignedStudents) ? ex.assignedStudents : (ex.targetStudentEmail ? [ex.targetStudentEmail] : []),
                date: ex.date || 'Upcoming',
                time: ex.time || ex.startTime || '10:00 AM',
                startTime: ex.startTime || ex.time || '10:00 AM',
                endTime: ex.endTime || '',
                duration: `${ex.duration || ex.durationMinutes || 60} min`,
                durationMinutes: Number(ex.duration || ex.durationMinutes || 60),
                status: ex.status || 'Published',
                instructions: ex.instructions || 'Read all theory questions carefully.',
                questions: (ex.questions && ex.questions.length > 0)
                  ? ex.questions.map((q, qIdx) => ({
                      id: q.id || q._id || qIdx + 1,
                      text: q.text || q.questionText || '',
                      type: q.type || q.questionType || 'Descriptive Theory',
                      options: q.options || [],
                      correctAnswer: q.correctAnswer || '',
                      marks: q.marks || 2
                    }))
                  : (existing.questions || [])
              });
            });
            setExams(deduplicateExamsList(Array.from(teacherMap.values())));
          }
        })
        .catch(() => {
          if (isMounted) {
            setExams(deduplicateExamsList(Array.from(teacherMap.values())));
          }
        });

      // 2. Sync Oral Viva exams published by teacher
      let activeTeacherVivas = [];
      try {
        const sharedOralVivasRaw = localStorage.getItem('shared_oral_vivas');
        if (sharedOralVivasRaw) {
          const parsedVivas = JSON.parse(sharedOralVivasRaw);
          if (Array.isArray(parsedVivas)) {
            activeTeacherVivas = parsedVivas.filter(isTeacherPublishedOralViva);
            setOralVivas(activeTeacherVivas);
          }
        }
      } catch (e) {}

      // 3. Sync completed exam results and teacher feedback
      try {
        const studentCompletedRaw = localStorage.getItem('student_completed_results');
        let userCompleted = [];
        const currentEmail = (student.email || studentProfile.email || '').toLowerCase().trim();
        const currentName = (student.name || studentProfile.name || '').toLowerCase().trim();

        const matchesStudent = (r) => {
          if (!r) return false;
          const rEmail = (r.studentEmail || r.email || '').toLowerCase().trim();
          const rName = (r.student || r.studentName || '').toLowerCase().trim();
          if (currentEmail && rEmail && currentEmail === rEmail) return true;
          if (currentName && currentName !== 'student' && rName && (currentName === rName || rName.includes(currentName) || currentName.includes(rName))) return true;
          if (rEmail === 'student@school.edu' || rEmail === 'student@blindassist.edu' || !rEmail) return true;
          return true;
        };

        if (studentCompletedRaw) {
          const parsedUserCompleted = JSON.parse(studentCompletedRaw);
          if (Array.isArray(parsedUserCompleted)) {
            // Automatically purge any terminated, exited, cancelled, or disqualified attempts
            const validCompletedOnly = parsedUserCompleted.filter(r => isExamSuccessfullyCompleted(r));
            if (validCompletedOnly.length !== parsedUserCompleted.length) {
              localStorage.setItem('student_completed_results', JSON.stringify(validCompletedOnly));
            }
            userCompleted = validCompletedOnly.filter(matchesStudent).map(r => {
              const rawEval = (r.evaluatedBy || r.teacherName || r.teacher || '').trim();
              const cleanEval = (rawEval.toLowerCase() === 'prof. sharma' || rawEval.toLowerCase() === 'sharma') ? '' : rawEval;
              return {
                ...r,
                evaluatedBy: cleanEval,
                teacherName: cleanEval
              };
            });
          }
        }

        const sharedResultsRaw = localStorage.getItem('shared_student_results');
        let sharedForStudent = [];
        if (sharedResultsRaw) {
          const parsed = JSON.parse(sharedResultsRaw);
          if (Array.isArray(parsed)) {
            // Automatically purge any terminated, exited, cancelled, or disqualified attempts
            const validSharedOnly = parsed.filter(r => isExamSuccessfullyCompleted(r));
            if (validSharedOnly.length !== parsed.length) {
              localStorage.setItem('shared_student_results', JSON.stringify(validSharedOnly));
            }
            sharedForStudent = validSharedOnly
              .filter(matchesStudent)
              .map((r, idx) => {
                const rawEval = (r.evaluatedBy || r.teacherName || r.teacher || '').trim();
                const cleanEval = (rawEval.toLowerCase() === 'prof. sharma' || rawEval.toLowerCase() === 'sharma') ? '' : rawEval;
                return {
                  id: r.id || `shared-res-${idx}`,
                  examName: r.examName || r.title || 'Theory Assessment',
                  subject: r.subject || 'Computer Science',
                  score: r.score || 0,
                  total: r.total || 100,
                  date: r.date || new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                  timeSpent: r.timeSpent || '0 mins',
                  feedback: r.feedback || 'Completed.',
                  status: r.status || 'Completed',
                  evaluatedBy: cleanEval,
                  teacherName: cleanEval,
                  teacherEmail: r.teacherEmail || '',
                  evaluatedAt: r.evaluatedAt || ''
                };
              });
          }
        }
        const combinedMap = new Map();
        userCompleted.forEach(r => combinedMap.set(String(r.id || r.examName), r));
        sharedForStudent.forEach(r => {
          const key = String(r.id || r.examName);
          const existing = combinedMap.get(key) || {};
          combinedMap.set(key, { ...existing, ...r });
        });
        setResults(Array.from(combinedMap.values()).filter(r => isExamSuccessfullyCompleted(r)));
      } catch (e) {}

      // 4. Sync notifications & announcements posted by teacher
      const sharedNotifRaw = localStorage.getItem('shared_notifications');
      let parsedNotifsList = [];
      if (sharedNotifRaw) {
        try {
          const p = JSON.parse(sharedNotifRaw);
          if (Array.isArray(p)) parsedNotifsList = p;
        } catch (e) {}
      }

      // Synthesize notifications for active oral vivas
      const vivasForNotifs = (activeTeacherVivas && activeTeacherVivas.length > 0) ? activeTeacherVivas : (Array.isArray(oralVivas) ? oralVivas : []);
      if (Array.isArray(vivasForNotifs) && vivasForNotifs.length > 0) {
        vivasForNotifs.forEach(v => {
          const vivaNotifId = `viva_notif_${v.id || v.title}`;
          const exists = parsedNotifsList.some(n => String(n.id) === vivaNotifId || (n.title && n.title.includes(v.title)));
          if (!exists) {
            parsedNotifsList.unshift({
              id: vivaNotifId,
              title: `🎙️ Active Oral Viva: ${v.title}`,
              detail: `Teacher published an oral viva examination for ${v.subject || activeSubject} (${v.questions?.length || 1} questions). Spoken practice and teacher evaluation active.`,
              date: v.date || 'Today',
              type: 'Oral Viva',
              icon: '🎙️',
              read: false,
              targetStudentEmail: v.targetStudentEmail || '',
              targetStudentName: v.targetStudentName || ''
            });
          }
        });
      }

      if (parsedNotifsList.length > 0) {
        try {
          const parsedNotifs = parsedNotifsList;
          if (Array.isArray(parsedNotifs)) {
            const studentEmail = (student.email || studentProfile.email || '').toLowerCase().trim();
            const studentName = (student.name || studentProfile.name || '').toLowerCase().trim();

            const cleanNotifs = parsedNotifs.filter(n => isNotificationForStudent(n, studentEmail, studentName));

            setAnnouncements(cleanNotifs);
            if (cleanNotifs.length !== parsedNotifs.length) {
              localStorage.setItem('shared_notifications', JSON.stringify(cleanNotifs));
            }

            // Record seen notifications without intrusive popups
            cleanNotifs.forEach(n => {
              const notifIdStr = String(n.id);
              if (!seenNotifIdsRef.current.has(notifIdStr)) {
                seenNotifIdsRef.current.add(notifIdStr);
              }
            });
          }
        } catch (e) {}
      } else {
        setAnnouncements([]);
      }

      // 5. Sync Voice Broadcasts from Teacher
      const sharedBroadcastsRaw = localStorage.getItem('shared_voice_broadcasts');
      if (sharedBroadcastsRaw) {
        try {
          const parsedBroadcasts = JSON.parse(sharedBroadcastsRaw);
          if (Array.isArray(parsedBroadcasts)) {
            setBroadcasts(parsedBroadcasts);
          }
        } catch (e) {}
      }

      // 6. Sync study materials & AI PDF lessons uploaded by teacher
      const sharedMaterialsRaw = localStorage.getItem('shared_study_materials');
      if (sharedMaterialsRaw) {
        try {
          const parsed = JSON.parse(sharedMaterialsRaw);
          if (Array.isArray(parsed)) {
            const filtered = parsed.filter(m => 
              !(m.id === 1 && m.title === 'Physics: Motion & Laws of Force') && 
              !(m.id === 2 && m.title === 'Computer Networks: OSI Model & Protocols') && 
              !(m.id === 3 && m.title === 'Mathematics: Algebra & Equations') &&
              !(m.id === 1 && m.title === 'Computer Networks OSI Layer Guide (PDF)') &&
              !(m.id === 2 && m.title === 'OS Deadlocks Audio Lecture & Voice Notes') &&
              !(m.id === 3 && m.title === 'Cyber Security Phishing Defense Book')
            );
            setStudyMaterials(filtered);
          }
        } catch (e) {}
      }

      // 7. Sync Student Assistance Replies from Teacher
      try {
        const sharedAssistRaw = localStorage.getItem('shared_assistance_requests');
        if (sharedAssistRaw) {
          const parsedAssist = JSON.parse(sharedAssistRaw);
          if (Array.isArray(parsedAssist)) {
            const studentRequests = parsedAssist.filter(r => 
              (r.student && (r.student.toLowerCase().includes((student.name || '').toLowerCase()) || r.student.toLowerCase().includes((studentProfile.name || '').toLowerCase()))) ||
              (r.studentName && (r.studentName.toLowerCase().includes((student.name || '').toLowerCase()) || r.studentName.toLowerCase().includes((studentProfile.name || '').toLowerCase())))
            );
            studentRequests.forEach(req => {
              if (req.status && req.status.includes('Responded') && !seenNotifIdsRef.current.has(`assist_${req.id}`)) {
                seenNotifIdsRef.current.add(`assist_${req.id}`);
                const assistMsg = `Teacher Assistance Update: ${req.status} for request "${req.question || req.request || 'Emergency SOS'}".`;
                announce(assistMsg);
                speakText(assistMsg);
              }
            });
          }
        }
      } catch (e) {}

      // 8. Sync Accessibility Rules (Voice speed, Auto-save, Auto-submit)
      try {
        const sharedAccessRaw = localStorage.getItem('shared_accessibility_rules');
        if (sharedAccessRaw) {
          const parsedAccess = JSON.parse(sharedAccessRaw);
          if (parsedAccess && typeof parsedAccess === 'object') {
            setAccessibility(prev => ({
              ...prev,
              ttsEnabled: parsedAccess.tts !== false,
              sttEnabled: parsedAccess.voice !== false,
              highContrast: !!parsedAccess.contrast
            }));
          }
        }
      } catch (e) {}

      // 9. Sync Teacher Published Oral Vivas
      try {
        const sharedOralVivasRaw = localStorage.getItem('shared_oral_vivas');
        if (sharedOralVivasRaw) {
          const parsedVivas = JSON.parse(sharedOralVivasRaw);
          if (Array.isArray(parsedVivas)) {
            const filtered = parsedVivas.filter(isTeacherPublishedOralViva);
            setOralVivas(filtered);
            setVivaSubject(prev => {
              if (!prev || !filtered.some(v => v.title === prev || v.subject === prev || String(v.id) === prev)) {
                return filtered.length > 0 ? (filtered[0].title || filtered[0].subject) : '';
              }
              return prev;
            });
          }
        }
        const rawVivaSubs = localStorage.getItem('shared_viva_submissions');
        if (rawVivaSubs) {
          const parsedSubs = JSON.parse(rawVivaSubs);
          if (Array.isArray(parsedSubs)) {
            setVivaSubmissionsList(parsedSubs);
          }
        }
      } catch (e) {}
    };

    syncFromTeacher();
    window.addEventListener('storage', syncFromTeacher);
    const interval = setInterval(syncFromTeacher, 2000);
    return () => {
      isMounted = false;
      window.removeEventListener('storage', syncFromTeacher);
      clearInterval(interval);
    };
  }, []);

  const handleSubmitExam = () => {
    setExamSubmitted(true);
    if (!currentExam) return;

    const finalAnswers = {
      ...studentAnswers,
      [`${currentExam.id}-${currentQIndex}`]: currentAnswerInput,
      [`${currentExam._id || currentExam.id}-${currentQIndex}`]: currentAnswerInput,
      [currentQIndex]: currentAnswerInput,
      [`q_${currentQIndex}`]: currentAnswerInput,
      [`${currentExam.questions?.[currentQIndex]?.id || currentQIndex + 1}`]: currentAnswerInput
    };
    setStudentAnswers(finalAnswers);

    // Compute question-by-question breakdown for teacher correction
    const totalPossibleMarks = (currentExam.questions || []).reduce((acc, q) => acc + (Number(q.marks) || 5), 0) || 100;
    
    const formattedQuestions = (currentExam.questions || []).map((q, idx) => {
      const qId = q.id !== undefined ? q.id : idx + 1;
      const studentAns = finalAnswers[`${currentExam.id}-${idx}`]
        || finalAnswers[`${currentExam._id || currentExam.id}-${idx}`]
        || finalAnswers[qId]
        || finalAnswers[`${qId}`]
        || finalAnswers[`q_${qId}`]
        || finalAnswers[idx]
        || finalAnswers[`q_${idx}`]
        || (idx === currentQIndex ? currentAnswerInput : '')
        || 'No answer recorded';
      const qMarks = Number(q.marks) || 5;
      
      // Auto-scoring logic for preliminary mark
      let initialAwarded = 0;
      if (q.type === 'MCQ' || q.type === 'True/False') {
        const isMatch = q.correctAnswer && studentAns && (
          studentAns.toLowerCase().trim() === q.correctAnswer.toLowerCase().trim() ||
          studentAns.toLowerCase().includes(q.correctAnswer.toLowerCase().trim()) ||
          q.correctAnswer.toLowerCase().includes(studentAns.toLowerCase().trim())
        );
        initialAwarded = isMatch ? qMarks : 0;
      } else {
        if (studentAns && studentAns.length > 20 && studentAns !== 'No answer recorded') {
          initialAwarded = Math.max(1, Math.round(qMarks * 0.85));
        } else if (studentAns && studentAns !== 'No answer recorded') {
          initialAwarded = Math.max(1, Math.round(qMarks * 0.5));
        }
      }

      return {
        id: q.id || idx + 1,
        text: q.text || q.questionText || `Question ${idx + 1}`,
        type: q.type || 'Descriptive Theory',
        options: q.options || [],
        correctAnswer: q.correctAnswer || '',
        studentAnswer: studentAns,
        studentAnswerLanguage: 'en',
        translatedAnswer: studentAns,
        maxMarks: qMarks,
        marksAwarded: initialAwarded,
        teacherComment: ''
      };
    });

    const sumAwarded = formattedQuestions.reduce((acc, q) => acc + q.marksAwarded, 0);
    const earnedScore = Math.min(100, Math.round((sumAwarded / totalPossibleMarks) * 100));

    let examTeacher = (currentExam.teacher || currentExam.teacherName || currentExam.createdBy || currentExam.author || currentExam.invigilator || '').replace(/Prof\. Sharma/gi, '').trim();
    let examTeacherEmail = (currentExam.teacherEmail || currentExam.creatorEmail || '').toLowerCase().trim();

    if (!examTeacher || !examTeacherEmail) {
      try {
        const loggedMap = JSON.parse(localStorage.getItem('logged_in_users') || '{}');
        const teachersList = Object.values(loggedMap).filter(u => u.role === 'teacher' && (u.name || u.email));
        const subjTeacher = teachersList.find(t => isSubjectMatching(t.subject, currentExam.subject)) || teachersList[0];
        if (subjTeacher) {
          if (!examTeacher && subjTeacher.name) examTeacher = subjTeacher.name;
          if (!examTeacherEmail && subjTeacher.email) examTeacherEmail = subjTeacher.email.toLowerCase().trim();
        }
      } catch (e) {}
    }
    if (!examTeacher || !examTeacherEmail) {
      try {
        const sharedTeachers = JSON.parse(localStorage.getItem('shared_teachers_list') || '[]');
        const subjTeacher = sharedTeachers.find(t => isSubjectMatching(t.subject, currentExam.subject)) || sharedTeachers[0];
        if (subjTeacher) {
          if (!examTeacher && (subjTeacher.name || subjTeacher.fullName)) examTeacher = subjTeacher.name || subjTeacher.fullName;
          if (!examTeacherEmail && subjTeacher.email) examTeacherEmail = subjTeacher.email.toLowerCase().trim();
        }
      } catch (e) {}
    }
    if (!examTeacher) examTeacher = 'Faculty Course Invigilator';
    if (!examTeacherEmail) examTeacherEmail = 'teacher@school.edu';

    const newResult = {
      id: Date.now(),
      student: student.name,
      studentId: student.studentId || student.registerNumber || '2024001',
      studentEmail: student.email || 'student@school.edu',
      examId: currentExam.id,
      examName: currentExam.title,
      examTitle: currentExam.title,
      examLanguage: 'en',
      languageName: 'English',
      subject: currentExam.subject || 'General',
      score: sumAwarded,
      total: totalPossibleMarks,
      totalMarks: totalPossibleMarks,
      percentage: earnedScore,
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      submittedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ', ' + new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      timeSpent: `${Math.max(1, Math.floor((5400 - examTimeRemaining) / 60))} mins`,
      feedback: 'Pending Teacher Final Evaluation & Feedback.',
      status: 'Pending Correction',
      evaluatedBy: examTeacher,
      teacherName: examTeacher,
      teacherEmail: examTeacherEmail,
      isBroadcast: true,
      questions: formattedQuestions,
      answers: finalAnswers
    };

    setResults(prev => [newResult, ...prev]);

    // Send submission live to Teacher Dashboard and persist in student_completed_results
    try {
      const existingCompleted = JSON.parse(localStorage.getItem('student_completed_results') || '[]');
      localStorage.setItem('student_completed_results', JSON.stringify([newResult, ...existingCompleted]));

      const existingShared = JSON.parse(localStorage.getItem('shared_student_results') || '[]');
      const updatedShared = [newResult, ...existingShared.filter(r => r.id !== newResult.id)];
      localStorage.setItem('shared_student_results', JSON.stringify(updatedShared));

      // Update Teacher Live Monitoring logs
      const existingLogs = JSON.parse(localStorage.getItem('shared_live_logs') || '[]');
      const priorLog = existingLogs.find(l => l && l.student === student.name);
      const newLog = {
        id: priorLog?.id || `log_${currentExam?.id || currentExam?._id || Date.now()}`,
        student: student.name,
        studentName: student.name,
        teacherEmail: examTeacherEmail,
        teacherName: examTeacher,
        examId: currentExam?.id || currentExam?._id || '',
        examTitle: currentExam?.title || '',
        subject: currentExam?.subject || 'Computer Science',
        status: 'Submitted / Needs Correction',
        statusBadge: '🔵 Completed / Submitted',
        started: priorLog?.started || priorLog?.start || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        start: priorLog?.started || priorLog?.start || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        remaining: '00:00:00',
        answered: `${Object.keys(finalAnswers).length} / ${(currentExam.questions || []).length || 3}`,
        voice: 'Completed',
        submitted: 'Yes',
        faceVerified: true,
        facePresent: true,
        isOtherPerson: false,
        isMultiplePeople: false,
        timestamp: Date.now()
      };
      localStorage.setItem('shared_live_logs', JSON.stringify([newLog, ...existingLogs.filter(l => l.student !== student.name)]));

      const notifItem = {
        id: `notif_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        title: `📝 New Exam Submission: ${student.name}`,
        detail: `${student.name} has submitted '${currentExam.title}' (${currentExam.subject || 'Assessment'}). Awaiting teacher review and grading.`,
        date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ', ' + new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        type: 'Exam Submission',
        teacherEmail: examTeacherEmail,
        read: false
      };
      const existingNotifs = JSON.parse(localStorage.getItem('shared_notifications') || '[]');
      localStorage.setItem('shared_notifications', JSON.stringify([notifItem, ...existingNotifs]));

      window.dispatchEvent(new Event('storage'));
    } catch (e) {}

    // Cleanly stop webcam face proctoring upon exam completion
    stopCameraForFaceAuth();
    setIsExamActive(false);

    speakText("Congratulations! Your theory exam has been submitted successfully to your teacher for correction and grading.");
  };

  // Unified Voice and Text Command Processor
  const executeCommand = (rawText) => {
    if (!rawText) return;
    const transcript = rawText.toLowerCase().trim();
    announce(`Voice Command: "${transcript}"`);

    // Close Voice Assistant Overlay command
    if (transcript === 'close' || transcript === 'exit' || transcript === 'cancel' || transcript === 'dismiss' || transcript.includes('close overlay') || transcript.includes('close assistant') || transcript.includes('close voice assistant')) {
      closeVoiceAssistant(true);
      return;
    }

    // -------------------------------------------------------------------------
    // STRICT ACTIVE EXAM MODE: When student is taking an exam, Voice Assistant
    // speaks and processes ONLY exam-related content (questions, answers, navigation, SOS).
    // It NEVER prompts for interested subject, NEVER switches subjects, and NEVER lists features!
    // -------------------------------------------------------------------------
    const isStudentInActiveExam = Boolean(
      (currentExam || isExamActive) &&
      !examSubmitted &&
      (activeTab === 'AI Exam Assistant' || activeTab === 'Active Exam' || isExamActive)
    );

    if (isStudentInActiveExam) {
      // 1. Exit / Cancel Exam
      if (transcript.includes('exit exam') || transcript.includes('cancel exam') || transcript.includes('quit exam') || transcript.includes('leave exam')) {
        handleExitExamWithoutSubmitting();
        return;
      }

      // 2. Submit Exam
      if (transcript === 'submit' || transcript.includes('submit exam') || transcript.includes('say submit') || transcript.includes('finish exam') || transcript.includes('complete exam')) {
        handleSubmitExam();
        return;
      }

      // 3. Next Question / Save and Next
      if (transcript === 'next' || transcript.includes('next question') || transcript.includes('say next question') || transcript.includes('save and next') || transcript.includes('go to next')) {
        handleSaveAndNext();
        return;
      }

      // 4. Previous Question
      if (transcript === 'previous' || transcript === 'back' || transcript.includes('previous question') || transcript.includes('go back')) {
        handlePreviousQ();
        return;
      }

      // 5. Repeat / Read Question
      if (transcript.includes('repeat question') || transcript.includes('read question') || transcript.includes('say repeat question') || transcript.includes('say question') || transcript === 'repeat the question' || transcript === 'read the question' || (transcript === 'repeat' && !currentAnswerInput)) {
        handleReadExamQuestionStepByStep(currentQIndex);
        return;
      }

      // 6. Repeat Answer / Say Your Answer Again
      if (transcript.includes('repeat answer') || transcript.includes('say your answer again') || transcript.includes('say answer again') || transcript.includes('your answer again') || transcript.includes('answer again') || transcript.includes('repeat my answer') || transcript.includes('change answer') || transcript.includes('re-answer') || transcript.includes('re-record') || transcript.includes('clear answer') || (transcript === 'repeat' && currentAnswerInput)) {
        updateCurrentAnswer('');
        speakText("Clearing previous answer. Please speak your answer again now.", () => {
          setTimeout(() => {
            handleStartExamAnswerDictation();
          }, 300);
        });
        return;
      }

      // 6b. Say Your Answer / Answer by Voice
      if (transcript === 'answer' || transcript === 'say your answer' || transcript === 'your answer' || transcript === 'speak answer' || transcript.includes('answer by voice') || transcript.includes('start answer')) {
        speakText("Please speak your answer now. When finished, say DONE.", () => {
          setTimeout(() => {
            handleStartExamAnswerDictation();
          }, 300);
        });
        return;
      }

      // 6c. Done / Finish Answering
      if (transcript === 'done' || transcript === 'say done' || transcript === 'finish') {
        handleFinishExamAnswerDictation(currentAnswerInputRef.current || currentAnswerInput);
        return;
      }

      // 7. Check / Read Recorded Answer
      if (transcript.includes('read my answer') || transcript.includes('listen my answer') || transcript.includes('read answer') || transcript.includes('what is my answer') || transcript.includes('what did i answer')) {
        speakText(`Your recorded answer is: ${currentAnswerInput || 'empty'}. Say Next Question to proceed, or say Repeat Answer to re-record.`);
        return;
      }

      // 8. Remaining Time Check
      if (transcript.includes('time') || transcript.includes('remaining') || transcript.includes('clock') || transcript.includes('how much time')) {
        const mins = Math.floor(examTimeRemaining / 60);
        speakText(`You have ${mins} minutes remaining in your exam.`);
        return;
      }

      // 9. SOS / Emergency
      if (transcript.includes('emergency') || transcript.includes('sos') || transcript.includes('teacher assist')) {
        handleEmergencyAssistAlert();
        return;
      }

      // 10. MCQ Option Confirmation
      if (transcript.includes('confirm') || transcript.includes('confirm answer')) {
        setMcqConfirmationPending(false);
        speakText("Answer confirmed.");
        handleSaveAndNext();
        return;
      }

      // 11. MCQ Option selection
      const currentQ = currentExam?.questions?.[currentQIndex];
      if (currentQ?.options && currentQ.options.length > 0) {
        let selectedOption = null;
        if (transcript.includes('option a') || transcript.includes('select a') || transcript.includes('choice a') || transcript === 'a' || transcript === 'option 1' || transcript === '1') {
          selectedOption = currentQ.options[0];
        } else if (transcript.includes('option b') || transcript.includes('select b') || transcript.includes('choice b') || transcript === 'b' || transcript === 'option 2' || transcript === '2') {
          selectedOption = currentQ.options[1];
        } else if (transcript.includes('option c') || transcript.includes('select c') || transcript.includes('choice c') || transcript === 'c' || transcript === 'option 3' || transcript === '3') {
          selectedOption = currentQ.options[2];
        } else if (transcript.includes('option d') || transcript.includes('select d') || transcript.includes('choice d') || transcript === 'd' || transcript === 'option 4' || transcript === '4') {
          selectedOption = currentQ.options[3];
        } else {
          for (const opt of currentQ.options) {
            const optLower = opt.toLowerCase();
            if (transcript.includes(optLower) || (optLower.length > 8 && transcript.includes(optLower.slice(0, 15)))) {
              selectedOption = opt;
              break;
            }
          }
        }

        if (selectedOption) {
          updateCurrentAnswer(selectedOption);
          setMcqConfirmationPending(false);
          const promptText = `You answered: "${selectedOption}". Say your command: repeat answer, or to say answer again, or next question, or repeat question, or submit.`;
          speakText(promptText);
          return;
        }
      }

      // 12. Candidate's Spoken Answer (Default during exam)
      const cleanAnswer = rawText.replace(/^(answer|my answer is|option)\s*/i, '').trim() || rawText;
      updateCurrentAnswer(cleanAnswer);
      const promptText = `You answered: "${cleanAnswer}". Say your command: repeat answer, or to say answer again, or next question, or repeat question, or submit.`;
      speakText(promptText);
      return;
    }

    // -------------------------------------------------------------------------
    // STRICT ACTIVE ORAL VIVA MODE: When student is in viva simulator,
    // Voice Assistant handles only viva questions, answers & commands.
    // NEVER switch subjects, NEVER list features, NEVER ask for interested subject!
    // -------------------------------------------------------------------------
    const isStudentInActiveViva = Boolean(activeTab === 'AI Oral Viva Simulator');
    if (isStudentInActiveViva) {
      const activeVivaList = resolveCurrentVivaList();
      const curVivaQIdx = activeVivaList.length > 0 ? (vivaQIndex % activeVivaList.length) : 0;

      // 1. Submit Viva
      if (transcript === 'submit' || transcript.includes('submit viva') || transcript.includes('say submit') || transcript.includes('finish viva') || transcript.includes('complete viva')) {
        handleSubmitVivaExam();
        return;
      }

      // 2. Next Question
      if (transcript === 'next' || transcript.includes('next question') || transcript.includes('say next question') || transcript.includes('next viva') || transcript.includes('save and next')) {
        handleNextVivaQuestion();
        return;
      }

      // 3. Previous Question
      if (transcript === 'previous' || transcript === 'back' || transcript.includes('previous question') || transcript.includes('go back')) {
        handlePrevVivaQuestion();
        return;
      }

      // 4. Repeat Viva Question
      if (transcript.includes('repeat question') || transcript.includes('read question') || transcript.includes('say repeat question') || transcript.includes('say question') || (transcript === 'repeat' && !vivaAnswerInput)) {
        handleRepeatVivaQuestion();
        return;
      }

      // 5. Repeat Answer / Say Your Answer Again
      if (transcript.includes('repeat answer') || transcript.includes('say your answer again') || transcript.includes('say answer again') || transcript.includes('your answer again') || transcript.includes('answer again') || transcript.includes('repeat my answer') || transcript.includes('change answer') || (transcript === 'repeat' && vivaAnswerInput)) {
        setVivaAnswerInput('');
        setVivaAnswersRecord(prev => ({ ...prev, [curVivaQIdx]: '' }));
        lastSpokenVivaAnswerRef.current = '';
        speakText("Clearing previous answer. Please speak your answer again now.", () => {
          setTimeout(() => {
            startVivaDictation(false);
          }, 300);
        });
        return;
      }

      // 5b. Say Your Answer / Answer Viva
      if (transcript === 'answer' || transcript === 'say your answer' || transcript === 'your answer' || transcript === 'speak answer' || transcript.includes('answer viva') || transcript.includes('start viva answer')) {
        speakText("Please speak your viva answer now. When finished, say DONE.", () => {
          setTimeout(() => {
            startVivaDictation(false);
          }, 300);
        });
        return;
      }

      // 5c. Done / Finish Viva Response
      if (transcript === 'done' || transcript === 'say done' || transcript === 'finish') {
        stopVivaDictation(true);
        return;
      }

      // 6. Read Viva Answer
      if (transcript.includes('read my answer') || transcript.includes('listen my answer') || transcript.includes('read answer')) {
        speakText(`Your recorded viva answer is: ${vivaAnswerInput || 'empty'}. Say Next Question to proceed, or say Repeat Answer to re-record.`);
        return;
      }

      // 7. Restart Viva
      if (transcript.includes('restart viva') || transcript.includes('retake viva')) {
        handleRestartViva();
        return;
      }

      // 8. Viva Answer Spoken by Candidate
      const cleanAnswer = rawText.replace(/^(answer|my answer is|viva answer is)\s*/i, '').trim() || rawText;
      setVivaAnswerInput(cleanAnswer);
      setVivaAnswersRecord(prev => ({ ...prev, [curVivaQIdx]: cleanAnswer }));
      lastSpokenVivaAnswerRef.current = cleanAnswer;
      const promptText = `You answered: "${cleanAnswer}". Say your command: repeat answer, or to say answer again, or next question, or repeat question, or submit.`;
      speakText(promptText);
      return;
    }

    // -------------------------------------------------------------------------
    // STRICT STUDY MATERIALS PRACTICE & TEST MODE:
    // When student is in practice mode or taking test in Study Materials,
    // Voice Assistant handles only practice/test questions, answers, repeats & submit.
    // -------------------------------------------------------------------------
    const isStudentInStudyPractice = Boolean(activeTab === 'Study Materials' && activePracticeMat);
    const isStudentInStudyTest = Boolean(activeTab === 'Study Materials' && activeLessonTest);

    if (isStudentInStudyPractice) {
      const questionsList = (activePracticeMat.questions && activePracticeMat.questions.length > 0)
        ? activePracticeMat.questions
        : [{
            text: activePracticeMat.practiceQuestion || `Explain core concepts of ${activePracticeMat.title}`,
            oneLineAnswer: activePracticeMat.oneLineAnswer || activePracticeMat.practiceAnswer || activePracticeMat.correctAnswer || activePracticeMat.detail,
            explanation: activePracticeMat.explanation || activePracticeMat.textContent
          }];
      const totalQ = questionsList.length;
      const safeQIdx = Math.min(practiceQIdx, totalQ - 1);

      // 1. Submit Practice to Teacher
      if (transcript === 'submit' || transcript.includes('submit practice') || transcript.includes('submit test') || transcript.includes('say submit') || transcript.includes('finish practice') || transcript.includes('complete practice')) {
        handleSubmitPracticeToTeacher();
        return;
      }

      // 2. Next Question
      if (transcript === 'next' || transcript.includes('next question') || transcript.includes('say next question') || transcript.includes('save and next')) {
        const nextIdx = (safeQIdx + 1) % totalQ;
        setPracticeQIdx(nextIdx);
        setPracticeAnswerInput(practiceAnswersByQ[nextIdx] || '');
        setPracticeFeedback(null);
        handleSpeakQuestionAnswerExplanation(activePracticeMat, nextIdx);
        return;
      }

      // 3. Previous Question
      if (transcript === 'previous' || transcript === 'back' || transcript.includes('previous question') || transcript.includes('go back')) {
        const prevIdx = (safeQIdx - 1 + totalQ) % totalQ;
        setPracticeQIdx(prevIdx);
        setPracticeAnswerInput(practiceAnswersByQ[prevIdx] || '');
        setPracticeFeedback(null);
        handleSpeakQuestionAnswerExplanation(activePracticeMat, prevIdx);
        return;
      }

      // 4. Repeat Question
      if (transcript.includes('repeat question') || transcript.includes('read question') || transcript.includes('say repeat question') || transcript.includes('say question') || (transcript === 'repeat' && !practiceAnswerInput)) {
        handleSpeakQuestionAnswerExplanation(activePracticeMat, safeQIdx);
        return;
      }

      // 5. Repeat Answer / Say Your Answer Again
      if (transcript.includes('repeat answer') || transcript.includes('say your answer again') || transcript.includes('say answer again') || transcript.includes('your answer again') || transcript.includes('answer again') || transcript.includes('repeat my answer') || transcript.includes('repeat your answer') || transcript.includes('change answer') || transcript.includes('re-answer') || transcript.includes('clear answer') || (transcript === 'repeat' && practiceAnswerInput)) {
        setPracticeAnswerInput('');
        setPracticeAnswersByQ(prev => ({ ...prev, [safeQIdx]: '' }));
        speakText("Clearing previous answer. Please speak your practice answer again now.", () => {
          setTimeout(() => {
            handleStartVoiceDictationForPractice();
          }, 300);
        });
        return;
      }

      // 6. Say Your Answer / Answer Practice
      if (transcript === 'answer' || transcript === 'say your answer' || transcript === 'your answer' || transcript === 'speak answer' || transcript.includes('dictate') || transcript.includes('start answer')) {
        speakText("Please speak your practice answer now. When finished, say DONE.", () => {
          setTimeout(() => {
            handleStartVoiceDictationForPractice();
          }, 300);
        });
        return;
      }

      // 7. Done / Finish Answering
      if (transcript === 'done' || transcript === 'say done' || transcript === 'finish') {
        const ans = practiceAnswerInput || '';
        speakText(`You answered: "${ans}". Say your command: repeat answer, or to say answer again, or next question, or repeat question, or submit.`);
        return;
      }

      // 8. Evaluate Practice
      if (transcript.includes('evaluate') || transcript.includes('check answer')) {
        handleEvaluatePractice();
        return;
      }

      // 9. Close Practice
      if (transcript.includes('close practice') || transcript.includes('stop practice') || transcript.includes('close modal') || transcript.includes('exit practice')) {
        setActivePracticeMat(null);
        setPracticeFeedback(null);
        setPracticeAnswerInput('');
        speakText("Closed study practice mode.");
        return;
      }
    }

    if (isStudentInStudyTest) {
      // 1. Submit Test to Teacher
      if (transcript === 'submit' || transcript.includes('submit test') || transcript.includes('say submit') || transcript.includes('finish test') || transcript.includes('complete test')) {
        handleSubmitLessonTest();
        return;
      }

      // 2. Next Question / Save and Next
      if (transcript === 'next' || transcript.includes('next question') || transcript.includes('say next question') || transcript.includes('save and next')) {
        handleSaveLessonTestNext();
        return;
      }

      // 3. Repeat Question
      if (transcript.includes('repeat question') || transcript.includes('read question') || transcript.includes('say repeat question') || transcript.includes('say question') || (transcript === 'repeat' && !lessonTestInput)) {
        speakText(`Question ${lessonTestQIndex + 1}: ${activeLessonTest.questions[lessonTestQIndex]?.text}`);
        return;
      }

      // 4. Repeat Answer / Say Your Answer Again
      if (transcript.includes('repeat answer') || transcript.includes('say your answer again') || transcript.includes('say answer again') || transcript.includes('your answer again') || transcript.includes('answer again') || transcript.includes('repeat my answer') || transcript.includes('repeat your answer') || transcript.includes('change answer') || transcript.includes('re-answer') || transcript.includes('clear answer') || (transcript === 'repeat' && lessonTestInput)) {
        setLessonTestInput('');
        speakText("Clearing previous answer. Please speak your test answer again now.", () => {
          setTimeout(() => {
            handleStartLessonTestDictation();
          }, 300);
        });
        return;
      }

      // 5. Say Your Answer / Answer Test
      if (transcript === 'answer' || transcript === 'say your answer' || transcript === 'your answer' || transcript === 'speak answer' || transcript.includes('dictate') || transcript.includes('start answer')) {
        speakText("Please speak your test answer now. When finished, say DONE.", () => {
          setTimeout(() => {
            handleStartLessonTestDictation();
          }, 300);
        });
        return;
      }

      // 6. Done / Finish Answering
      if (transcript === 'done' || transcript === 'say done' || transcript === 'finish') {
        const ans = lessonTestInput || '';
        speakText(`You answered: "${ans}". Say your command: repeat answer, or to say answer again, or next question, or repeat question, or submit.`);
        return;
      }

      // 7. Close Test
      if (transcript.includes('close test') || transcript.includes('stop test') || transcript.includes('exit test')) {
        setActiveLessonTest(null);
        setLessonTestFeedback(null);
        setLessonTestInput('');
        speakText("Closed study test mode.");
        return;
      }
    }

    // Voice Profile Wizard Trigger
    if (transcript.includes('fill profile') || transcript.includes('voice profile') || transcript.includes('fill details') || transcript.includes('fill student profile') || transcript.includes('setup profile') || transcript.includes('edit profile by voice') || transcript.includes('profile by voice')) {
      closeVoiceAssistant(false);
      setActiveTab('Profile');
      setTimeout(() => {
        startVoiceProfileWizard();
      }, 350);
      return;
    }

    // 1. Command: Speak all features that are present
    if (
      transcript.includes('speak all the features that are present') ||
      transcript.includes('speak all the features') ||
      transcript.includes('speak all features that are present') ||
      transcript.includes('speak all features') ||
      transcript.includes('all the features that are present') ||
      transcript.includes('all features that are present') ||
      transcript.includes('features that are present') ||
      transcript.includes('what are the features') ||
      transcript.includes('speak features') ||
      transcript.includes('tell me features') ||
      transcript.includes('tell me all features') ||
      transcript.includes('list all features') ||
      transcript.includes('list features') ||
      transcript === 'features' ||
      transcript === 'all features'
    ) {
      closeVoiceAssistant(false);
      speakDashboardFeatures();
      return;
    }

    // 2. Command: User sets / changes interested subject ("my interested subject is xyz...")
    const subjectPrefixRegex = /(?:my\s+(?:interested|intrested)\s+subject\s+(?:is|to|as)|(?:interested|intrested)\s+subject\s+(?:is|to|as)|(?:change|switch|set)\s+(?:my\s+)?(?:interested\s+|intrested\s+)?subject\s+(?:to|is|as)|my\s+subject\s+is|interested\s+in|intrested\s+in)\s+(.*)/i;
    const prefixMatch = transcript.match(subjectPrefixRegex);
    if (prefixMatch && prefixMatch[1]) {
      const rawCandidate = prefixMatch[1].trim();
      const matchedSubject = findMainSubject(rawCandidate) || findMainSubject(transcript);
      if (matchedSubject) {
        closeVoiceAssistant(false);
        handleSwitchStudentSubject(matchedSubject);
        return;
      } else {
        closeVoiceAssistant(false);
        speakText(`I heard your interested subject as ${rawCandidate}. Please choose from our main academic subjects: Computer Science, Mathematics, Physics, Chemistry, Biology, Commerce, Social Science, or Engineering.`);
        return;
      }
    }

    // 3. Main Subjects Voice Matching & Switching
    const matchedMain = findMainSubject(transcript);
    if (matchedMain) {
      const lowerMain = matchedMain.toLowerCase();
      if (
        transcript === lowerMain ||
        transcript.includes(lowerMain) ||
        transcript.includes(`switch to ${lowerMain}`) || 
        transcript.includes(`change subject to ${lowerMain}`) || 
        transcript.includes(`choose ${lowerMain}`) || 
        transcript.includes(`select ${lowerMain}`) ||
        transcript.includes(`like ${lowerMain}`) ||
        transcript.includes(`interested in ${lowerMain}`) ||
        transcript.includes(`intrested in ${lowerMain}`) ||
        transcript.includes(`focus on ${lowerMain}`) ||
        transcript.startsWith('subject ') ||
        transcript.endsWith(' subject') ||
        transcript === 'computer science' ||
        transcript === 'mathematics' ||
        transcript === 'physics' ||
        transcript === 'chemistry' ||
        transcript === 'biology' ||
        transcript === 'commerce' ||
        transcript === 'social science' ||
        transcript === 'engineering'
      ) {
        closeVoiceAssistant(false);
        handleSwitchStudentSubject(matchedMain);
        return;
      }
    }

    if (transcript.includes('what is my subject') || transcript.includes('current subject') || transcript.includes('which subject') || transcript.includes('my subject')) {
      speakText(`Your currently focused academic subject is ${activeSubject}. Your dashboard displays only ${activeSubject} exams, study materials, and oral vivas.`);
      return;
    }

    // 1. Navigation and System Controls
    if (transcript.includes('where am i') || transcript.includes('what page') || transcript.includes('current page') || transcript.includes('status') || transcript.includes('where am i currently')) {
      handleWhereAmI();
      return;
    }
    if (transcript.includes('performance report') || transcript.includes('read performance') || transcript.includes('progress report') || transcript.includes('score summary')) {
      handleReadPerformanceReport();
      return;
    }
    if (transcript.includes('listen answer') || transcript.includes('answer and explanation') || transcript.includes('listen explanation') || transcript.includes('explain answer') || transcript.includes('explain concept') || transcript.includes('explain concepts') || transcript.includes('reference answer') || transcript.includes('listen question') || transcript.includes('practice question')) {
      handleSpeakQuestionAnswerExplanation(activePracticeMat);
      return;
    }
    if (transcript.includes('summarize material') || transcript.includes('ask tutor') || transcript.includes('ai summary')) {
      handleGenerateAiConceptSummary(activePracticeMat);
      return;
    }
    if (transcript.includes('bookmark') || transcript.includes('save bookmark')) {
      handleSaveBookmark(activePracticeMat?.title, activePracticeMat?.textContent);
      return;
    }
    if (transcript.includes('take test') || transcript.includes('lesson test') || transcript.includes('study test') || transcript.includes('test knowledge')) {
      handleStartLessonTest(activePracticeMat || filteredStudyMaterials[0]);
      return;
    }
    if (transcript.includes('speed up') || transcript.includes('faster speech')) {
      setAccessibility(prev => ({ ...prev, speechRate: 1.0 }));
      speakText("Voice speech rate set to 1.0x normal.");
      return;
    }
    if (transcript.includes('slow down') || transcript.includes('slower speech')) {
      setAccessibility(prev => ({ ...prev, speechRate: 0.75 }));
      speakText("Voice speech rate set to 0.75x slow.");
      return;
    }
    if (transcript.includes('next question') || transcript === 'next' || transcript.includes('save and next') || transcript.includes('go to next')) {
      if (currentExam && (activeTab === 'AI Exam Assistant' || activeTab === 'Active Exam' || activeTab === 'Exams' || isExamActive)) {
        handleSaveAndNext();
        return;
      } else {
        const list = filteredStudyMaterials && filteredStudyMaterials.length > 0 ? filteredStudyMaterials : defaultStudyMaterials;
        const currentMat = activePracticeMat || list[0];
        if (currentMat) {
          const qList = (currentMat.questions && currentMat.questions.length > 0) ? currentMat.questions : [currentMat];
          const nextQIdx = (practiceQIdx + 1) % qList.length;
          setPracticeQIdx(nextQIdx);
          handleSpeakQuestionAnswerExplanation(currentMat, nextQIdx);
        }
      }
      return;
    }
    if (transcript.includes('previous question') || transcript === 'previous' || transcript === 'back' || transcript.includes('go back')) {
      if (currentExam && (activeTab === 'AI Exam Assistant' || activeTab === 'Active Exam' || activeTab === 'Exams' || isExamActive)) {
        handlePreviousQ();
        return;
      } else {
        const list = filteredStudyMaterials && filteredStudyMaterials.length > 0 ? filteredStudyMaterials : defaultStudyMaterials;
        const currentMat = activePracticeMat || list[0];
        if (currentMat) {
          const qList = (currentMat.questions && currentMat.questions.length > 0) ? currentMat.questions : [currentMat];
          const prevQIdx = (practiceQIdx - 1 + qList.length) % qList.length;
          setPracticeQIdx(prevQIdx);
          handleSpeakQuestionAnswerExplanation(currentMat, prevQIdx);
        }
      }
      return;
    }
    if (transcript.includes('submit exam') || transcript.includes('finish exam')) {
      handleSubmitExam();
      return;
    }
    if (transcript.includes('exit exam') || transcript.includes('cancel exam') || transcript.includes('quit exam') || transcript.includes('leave exam')) {
      if (currentExam || isExamActive) {
        handleExitExamWithoutSubmitting();
        return;
      }
    }
    if (transcript.includes('repeat answer') || transcript.includes('repeat my answer') || transcript.includes('change answer') || transcript.includes('re-answer') || (transcript === 'repeat' && currentAnswerInput) || (transcript === 'repeat' && vivaAnswerInput)) {
      if (activeTab === 'AI Oral Viva Simulator') {
        setVivaAnswerInput('');
        speakText("Clearing previous viva answer. Please speak your answer again now.", () => {
          setTimeout(() => {
            startVivaDictation();
          }, 300);
        });
        return;
      }
      if (currentExam && (activeTab === 'AI Exam Assistant' || activeTab === 'Active Exam' || activeTab === 'Exams' || isExamActive)) {
        updateCurrentAnswer('');
        speakText("Clearing previous answer. Please speak your answer again now.", () => {
          setTimeout(() => {
            handleStartExamAnswerDictation();
          }, 300);
        });
        return;
      }
    }
    if (transcript.includes('read question') || transcript.includes('repeat question') || transcript.includes('say question') || (transcript === 'repeat' && !currentAnswerInput && !vivaAnswerInput)) {
      if (activeTab === 'AI Oral Viva Simulator') {
        handleRepeatVivaQuestion();
        return;
      }
      if (currentExam && (activeTab === 'AI Exam Assistant' || activeTab === 'Active Exam' || activeTab === 'Exams' || isExamActive)) {
        handleReadExamQuestionStepByStep(currentQIndex);
        return;
      } else {
        handleSpeakQuestionAnswerExplanation(activePracticeMat, practiceQIdx);
      }
      return;
    }
    if (transcript.includes('time') || transcript.includes('remaining') || transcript.includes('clock')) {
      const mins = Math.floor(examTimeRemaining / 60);
      speakText(`You have ${mins} minutes remaining in your exam.`);
      return;
    }
    if (transcript.includes('emergency') || transcript.includes('sos')) {
      handleEmergencyAssistAlert();
      return;
    }
    if (transcript === 'help' || transcript.includes('what can i say') || transcript.includes('how to use') || transcript.includes('voice commands') || transcript.includes('typed commands')) {
      speakDashboardFeatures();
      return;
    }
    if (transcript.includes('read profile') || transcript.includes('narrate profile') || transcript.includes('read my profile') || transcript.includes('speak profile')) {
      setActiveTab('Profile');
      handleReadProfileAloud();
      return;
    }
    if (transcript.includes('logout') || transcript.includes('log out') || transcript.includes('sign out') || transcript === 'exit dashboard') {
      handleLogout();
      return;
    }

    // 4. Study Materials Voice Practice Mode
    if (activeTab === 'Study Materials') {
      if (activePracticeMat) {
        if (transcript.includes('evaluate') || transcript.includes('check answer')) {
          handleEvaluatePractice();
          return;
        }
        if (transcript.includes('close practice') || transcript.includes('stop practice') || transcript.includes('close modal')) {
          setActivePracticeMat(null);
          setPracticeFeedback(null);
          setPracticeAnswerInput('');
          speakText("Closed study practice mode.");
          return;
        }
        if (transcript.includes('repeat') || transcript.includes('say again') || transcript.includes('read again') || transcript.includes('speak again')) {
          handleRepeatSpeech();
          return;
        }
        if (transcript.includes('read question') || transcript.includes('repeat question')) {
          speakText(`Practice Question: ${activePracticeMat.practiceQuestion || activePracticeMat.title}`);
          return;
        }
        if (transcript.includes('read answer') || transcript.includes('listen answer') || transcript.includes('what is the answer') || transcript.includes('explain answer') || transcript.includes('reference answer')) {
          speakText(`Teacher's Reference Answer: ${activePracticeMat.practiceAnswer || activePracticeMat.textContent || activePracticeMat.detail}. Detailed Lesson Explanation: ${activePracticeMat.textContent || activePracticeMat.detail}`);
          return;
        }
        const cleanPractice = rawText.replace(/^(answer|my answer is)\s*/i, '').trim() || rawText;
        setPracticeAnswerInput(cleanPractice);
        speakText(`Practice answer recorded: ${cleanPractice}`);
        return;
      }
    }

    // 4. Tab Navigation & Features Commands
    if (transcript.includes('feature') || transcript.includes('all features') || transcript.includes('list features') || transcript.includes('what features') || transcript.includes('overview features')) {
      speakDashboardFeatures();
      return;
    }
    if (transcript.includes('dashboard') || transcript.includes('home') || transcript.includes('read dashboard')) {
      setActiveTab('Dashboard');
      speakText(`Opening Dashboard Home. Welcome ${student.name}. You have ${filteredExams.length} upcoming exam${filteredExams.length === 1 ? '' : 's'} and overall progress of ${overallProgress} percent.`);
    }
    else if (transcript.includes('start exam') || transcript.includes('take exam') || transcript.includes('begin exam') || transcript.includes('exam assistant') || transcript.includes('ai exam assistant') || transcript.includes('online exam')) {
      if (filteredExams && filteredExams.length > 0) {
        startExamHandler(filteredExams[0]);
      } else if (exams && exams.length > 0) {
        startExamHandler(exams[0]);
      } else {
        setActiveTab('AI Exam Assistant');
        speakText("Opening AI Exam Assistant.");
      }
    }
    else if (transcript.includes('viva') || transcript.includes('interview') || transcript.includes('oral')) {
      setActiveTab('AI Oral Viva Simulator');
      speakText(`Opening AI Oral Viva Simulator. Practice voice viva interviews for ${activeSubject}.`);
    }
    else if (transcript.includes('my exams') || transcript.includes('show exams') || transcript.includes('view exams') || transcript.includes('schedule') || transcript === 'exams' || transcript === 'tests') {
      setActiveTab('My Exams');
      speakText(`Opening My Exams. You have ${filteredExams.length} ${activeSubject} exams listed.`);
    }
    else if (transcript.includes('result') || transcript.includes('marks') || transcript.includes('score') || transcript.includes('performance') || transcript.includes('report card')) {
      setActiveTab('Results & Performance');
      speakResultsAndPerformancesReport();
    }
    else if (transcript.includes('written exam') || transcript.includes('written test') || transcript.includes('take written exam')) {
      setActiveTab('AI Exam Assistant');
      speakText(`Opening AI Exam Assistant for written examinations in ${activeSubject}.`);
    }
    else if (transcript.includes('certificate') || transcript.includes('award') || transcript.includes('diploma')) {
      setActiveTab('Certificates');
      speakText("Opening Voice Certificates. You can view and download your earned course completion certificates.");
    }
    else if (transcript.includes('study') || transcript.includes('material') || transcript.includes('audio lesson') || transcript.includes('notes') || transcript.includes('lesson')) {
      setActiveTab('Study Materials');
      speakText(`Opening Study Materials. Audio lessons and accessible study guides are available for ${activeSubject}.`);
    }
    else if (transcript.includes('voice assistant') || transcript.includes('voice mode')) {
      setActiveTab('Voice Assistant');
      speakText("Opening Voice Assistant controls. Tap anywhere on screen or press Spacebar to speak commands.");
    }
    else if (transcript.includes('accessibility') || transcript.includes('settings')) {
      setActiveTab('Accessibility Settings');
      speakText("Opening Accessibility Settings.");
    }
    else if (transcript.includes('high contrast') || transcript.includes('contrast')) {
      setAccessibility(prev => ({ ...prev, highContrast: !prev.highContrast }));
      speakText(`High contrast mode updated.`);
    }
    else if (transcript.includes('enable voice') || transcript.includes('turn on voice')) {
      setIsVoiceAssistantEnabled(true);
      localStorage.setItem('student_voice_assistant_enabled', 'true');
      speakText("Voice assistant is now enabled.");
    }
    else if (transcript.includes('disable voice') || transcript.includes('turn off voice') || transcript.includes('mute voice')) {
      setIsVoiceAssistantEnabled(false);
      localStorage.setItem('student_voice_assistant_enabled', 'false');
      speakText("Voice assistant has been disabled. You can still type commands in the command bar.");
    }
    else if (transcript.includes('repeat') || transcript.includes('say again') || transcript.includes('repeat speech') || transcript.includes('replay audio')) {
      handleRepeatSpeech();
    }
    else if (transcript.includes('notification') || transcript.includes('alert') || transcript.includes('announcement')) {
      setActiveTab('Notifications');
      speakText(`Opening Notifications. You have ${announcements.length} announcements.`);
    }
    else if (transcript.includes('profile') || transcript.includes('my profile') || transcript.includes('student id') || transcript.includes('account')) {
      setActiveTab('Profile');
      speakText(`Opening Profile. Student name ${student.name}, Register number ${studentProfile.registerNumber || student.studentId}.`);
    }
    else {
      setCurrentAnswerInput(rawText);
      speakText(`Command received: ${rawText}`);
    }
  };

  // Helper function to check if transcript ends with or contains completion keywords ("done", "finished", "complete", "done answer")
  const parseDoneTrigger = (text) => {
    if (!text) return { isDone: false, cleanText: '' };
    const trimmed = text.trim();
    const lower = trimmed.toLowerCase();
    const doneTriggers = [
      'done answer', 'done answering', 'done next', "that's all", 'that is all',
      'that is my answer', 'save and next', 'next question', 'done', 'finished',
      'complete', 'completed', 'finish', 'stop'
    ];
    for (const trigger of doneTriggers) {
      if (lower === trigger || lower.endsWith(' ' + trigger) || new RegExp(`\\b${trigger}\\b`, 'i').test(lower)) {
        const regex = new RegExp(`\\s*\\b${trigger}\\b\\s*`, 'gi');
        const cleanText = trimmed.replace(regex, ' ').replace(/\s+/g, ' ').trim();
        return { isDone: true, cleanText, trigger };
      }
    }
    return { isDone: false, cleanText: trimmed, trigger: '' };
  };

  // Centralized Safe Close Handler for Voice Assistant (Prevents any auto-reopening or overlap loops)
  const closeVoiceAssistant = (speakFeedback = true) => {
    voiceAssistantIsClosingRef.current = true;
    setIsVoiceListening(false);
    isVoiceListeningRef.current = false;
    setLiveVoiceTranscript('');

    if (voiceFallbackTimeoutRef.current) {
      clearTimeout(voiceFallbackTimeoutRef.current);
      voiceFallbackTimeoutRef.current = null;
    }
    if (voiceSilenceTimerRef.current) {
      clearTimeout(voiceSilenceTimerRef.current);
      voiceSilenceTimerRef.current = null;
    }

    if (activeVoiceRecognitionRef.current) {
      try {
        activeVoiceRecognitionRef.current.onstart = null;
        activeVoiceRecognitionRef.current.onresult = null;
        activeVoiceRecognitionRef.current.onerror = null;
        activeVoiceRecognitionRef.current.onend = null;
        activeVoiceRecognitionRef.current.stop();
        activeVoiceRecognitionRef.current.abort();
      } catch (err) {}
      activeVoiceRecognitionRef.current = null;
    }

    cancelSpeech();
    if (speakFeedback) {
      speakText("Voice Assistant closed.");
    }

    setTimeout(() => {
      voiceAssistantIsClosingRef.current = false;
    }, 250);
  };

  // Keyboard Spacebar listener to activate Voice Assistant, Escape to dismiss
  useEffect(() => {
    const handleDashboardKeys = (e) => {
      const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select' || document.activeElement?.isContentEditable) {
        return;
      }
      if (e.key === 'Escape' && isVoiceListening) {
        closeVoiceAssistant(true);
      } else if (e.code === 'Space' && !isVoiceListening) {
        e.preventDefault();
        triggerVoiceCommand();
      }
    };

    window.addEventListener('keydown', handleDashboardKeys);
    window.addEventListener('click', handleDashboardGlobalClick);
    return () => {
      window.removeEventListener('keydown', handleDashboardKeys);
      window.removeEventListener('click', handleDashboardGlobalClick);
    };
  }, [isVoiceListening, isVoiceAssistantEnabled, isVoiceProfileWizardOpen]);

  // Voice Assistant command trigger: speaks prompt, streams live speech transcript
  const triggerVoiceCommand = async (forceRestart = false) => {
    if (!isVoiceAssistantEnabled || isVoiceDisabled()) {
      announce("⚠️ Voice Assistant is disabled. Enable it from the top header.");
      return;
    }

    // SECURITY GATE: Voice Assistant only listens to the verified scanned student during active exams
    if (currentExam && (activeTab === 'AI Exam Assistant' || activeTab === 'Active Exam') && !examSubmitted) {
      if (!isScannedStudentWritingRef.current || isOtherPersonDetected || isMultiplePeopleDetectedRef.current) {
        const lockMsg = isMultiplePeopleDetectedRef.current
          ? `Voice assistant locked. Multiple people detected in front of camera (${detectedPeopleCount} individuals). Only candidate ${student.name} is permitted to speak or dictate answers.`
          : `Voice assistant locked. Unrecognized face detected in front of camera. Only scanned candidate ${student.name} is permitted to speak or dictate answers.`;
        announce("🔒 Voice Assistant Locked: " + (isMultiplePeopleDetectedRef.current ? "Multiple People Detected" : "Unauthorized Person"));
        speakText(lockMsg);
        return;
      }
    }

    if (isVoiceListeningRef.current && !forceRestart) return;
    voiceAssistantIsClosingRef.current = false;
    cancelSpeech();
    setIsVoiceListening(true);
    isVoiceListeningRef.current = true;
    setLiveVoiceTranscript('');

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    const startMicrophoneRecognition = () => {
      if (voiceAssistantIsClosingRef.current || !isVoiceListeningRef.current) return;
      if (!SpeechRecognition) {
        announce("Speech recognition is not supported in this browser.");
        return;
      }

      try {
        if (activeVoiceRecognitionRef.current) {
          try { 
            activeVoiceRecognitionRef.current.onstart = null;
            activeVoiceRecognitionRef.current.onresult = null;
            activeVoiceRecognitionRef.current.onerror = null;
            activeVoiceRecognitionRef.current.onend = null;
            activeVoiceRecognitionRef.current.abort(); 
          } catch (e) {}
          activeVoiceRecognitionRef.current = null;
        }

        const recognition = new SpeechRecognition();
        activeVoiceRecognitionRef.current = recognition;

        const activeExamSpeechLang = navigator.language || 'en-US';
        recognition.lang = activeExamSpeechLang;
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
          if (voiceAssistantIsClosingRef.current || !isVoiceListeningRef.current) {
            try { recognition.abort(); } catch (e) {}
            activeVoiceRecognitionRef.current = null;
            return;
          }
          setIsVoiceListening(true);
          isVoiceListeningRef.current = true;
        };

        recognition.onresult = (e) => {
          if (voiceAssistantIsClosingRef.current || !isVoiceListeningRef.current) return;

          // STRICT SECURITY GATE: Discard speech if multiple people or unauthorized face is detected during exam
          if (currentExam && (activeTab === 'AI Exam Assistant' || activeTab === 'Active Exam') && !examSubmitted) {
            if (!isScannedStudentWritingRef.current || isOtherPersonDetected || isMultiplePeopleDetectedRef.current) {
              console.warn("Speech dropped: Multiple people or unrecognized person detected in front of camera.");
              closeVoiceAssistant(false);
              announce(isMultiplePeopleDetectedRef.current ? "🔒 Ignored voice: Multiple people in camera." : "🔒 Ignored voice: Unauthorized person speaking.");
              return;
            }
          }

          let currentTranscript = '';
          for (let i = 0; i < e.results.length; i++) {
            currentTranscript += e.results[i][0].transcript;
          }
          const cleaned = currentTranscript.trim();
          pendingCommand = cleaned;
          setLiveVoiceTranscript(cleaned);

          const lower = cleaned.toLowerCase();

          // Explicit close command only when whole utterance is close command
          if (lower === 'close' || lower === 'close assistant' || lower === 'close overlay' || lower === 'close voice assistant' || lower === 'exit assistant' || lower === 'dismiss') {
            closeVoiceAssistant(true);
            return;
          }

          // Navigation & Action triggers
          const isNavTrigger = 
            lower === 'next question' || lower === 'say next question' || lower === 'to next question' || lower === 'next' || lower === 'save and next' || lower === 'next viva' ||
            lower === 'previous question' || lower === 'say previous question' || lower === 'to previous question' || lower === 'previous' || lower === 'back' ||
            lower === 'repeat question' || lower === 'say repeat question' || lower === 'to repeat question' || lower === 'read question' || lower === 'repeat the question' || lower === 'repeat' ||
            lower === 'submit' || lower === 'to submit' || lower === 'say submit' || lower === 'submit exam' || lower === 'submit viva' || lower === 'submit test' || lower === 'submit practice' || lower === 'finish exam' || lower === 'finish viva' || lower === 'finish test' || lower === 'finish practice' ||
            lower === 'say your answer' || lower === 'your answer' || lower === 'answer' || lower === 'speak answer' || lower === 'answer by voice' || lower === 'dictate' ||
            lower === 'done' || lower === 'say done' || lower === 'finish' ||
            lower.includes('exit exam');
          if (isNavTrigger) {
            closeVoiceAssistant(false);
            executeCommand(cleaned);
            return;
          }

          // Repeat answer / Read answer
          if (/\b(repeat answer|to repeat answer|repeat my answer|repeat your answer|read answer|read my answer|listen answer)\b/i.test(lower)) {
            closeVoiceAssistant(false);
            executeCommand('repeat answer');
            return;
          }

          // Say answer again / re-record
          if (/\b(say answer again|to say answer again|say your answer again|your answer again|answer again|re-record|change answer|try again|re-answer)\b/i.test(lower)) {
            closeVoiceAssistant(false);
            executeCommand('say answer again');
            return;
          }

          // Check if examinee said DONE to exit and save answer
          const { isDone, cleanText } = parseDoneTrigger(cleaned);

          const isStudentInActiveExam = Boolean((currentExam || isExamActive) && !examSubmitted && (activeTab === 'AI Exam Assistant' || activeTab === 'Active Exam' || isExamActive));
          const isStudentInActiveViva = Boolean(activeTab === 'AI Oral Viva Simulator');
          const isStudentInStudyPractice = Boolean(activeTab === 'Study Materials' && activePracticeMat);
          const isStudentInStudyTest = Boolean(activeTab === 'Study Materials' && activeLessonTest);

          if (isStudentInActiveExam) {
            const cleanAns = cleanText.replace(/^(answer|my answer is|option)\s*/i, '').trim() || cleanText;
            if (cleanAns) {
              setCurrentAnswerInput(cleanAns);
              currentAnswerInputRef.current = cleanAns;
              if (currentExam) {
                setStudentAnswers(prev => ({ ...prev, [`${currentExam.id}-${currentQIndex}`]: cleanAns }));
              }
            }

            if (isDone) {
              // User said DONE: exit voice assistant, save answer and read it back!
              closeVoiceAssistant(false);
              handleFinishExamAnswerDictation(cleanAns);
              return;
            }
            // Continuous listening: DO NOT EXIT in the middle while candidate speaks!
            return;
          } else if (isStudentInActiveViva) {
            const cleanAns = cleanText.replace(/^(answer|my answer is|viva answer is)\s*/i, '').trim() || cleanText;
            if (cleanAns) {
              setVivaAnswerInput(cleanAns);
              const activeVivaList = resolveCurrentVivaList();
              const curVivaQIdx = activeVivaList.length > 0 ? (vivaQIndex % activeVivaList.length) : 0;
              setVivaAnswersRecord(prev => ({ ...prev, [curVivaQIdx]: cleanAns }));
              lastSpokenVivaAnswerRef.current = cleanAns;
            }

            if (isDone) {
              // User said DONE in viva: exit voice assistant and read back answer!
              closeVoiceAssistant(false);
              stopVivaDictation(true);
              return;
            }
            // Continuous listening: DO NOT EXIT in the middle!
            return;
          } else if (isStudentInStudyPractice) {
            const cleanAns = cleanText.replace(/^(answer|my answer is|practice answer is)\s*/i, '').trim() || cleanText;
            if (cleanAns) {
              setPracticeAnswerInput(cleanAns);
              setPracticeAnswersByQ(prev => ({ ...prev, [practiceQIdx]: cleanAns }));
            }
            if (isDone) {
              closeVoiceAssistant(false);
              const promptText = `You answered: "${cleanAns}". Say your command: repeat answer, or to say answer again, or next question, or repeat question, or submit.`;
              speakText(promptText);
              return;
            }
            return;
          } else if (isStudentInStudyTest) {
            const cleanAns = cleanText.replace(/^(answer|my answer is|test answer is)\s*/i, '').trim() || cleanText;
            if (cleanAns) {
              setLessonTestInput(cleanAns);
            }
            if (isDone) {
              closeVoiceAssistant(false);
              const promptText = `You answered: "${cleanAns}". Say your command: repeat answer, or to say answer again, or next question, or repeat question, or submit.`;
              speakText(promptText);
              return;
            }
            return;
          } else {
            if (isDone) {
              closeVoiceAssistant(false);
              executeCommand(cleanText || cleaned);
              return;
            }

            if (voiceSilenceTimerRef.current) clearTimeout(voiceSilenceTimerRef.current);
            voiceSilenceTimerRef.current = setTimeout(() => {
              if (cleaned.length > 1 && !voiceAssistantIsClosingRef.current) {
                closeVoiceAssistant(false);
                executeCommand(cleaned);
              }
            }, 3500);
          }
        };

        recognition.onerror = (e) => {
          console.warn('SpeechRecognition error:', e);
          if (e.error === 'not-allowed') {
            announce("Microphone access denied. Please allow microphone permissions in your browser.");
            closeVoiceAssistant(false);
            return;
          }
          if (voiceAssistantIsClosingRef.current) {
            try { recognition.abort(); } catch (err) {}
          }
        };

        recognition.onend = () => {
          if (isVoiceListeningRef.current && !voiceAssistantIsClosingRef.current) {
            // Re-instantiate fresh recognition safely so Chrome continuously keeps listening!
            setTimeout(() => {
              if (isVoiceListeningRef.current && !voiceAssistantIsClosingRef.current) {
                startMicrophoneRecognition();
              }
            }, 100);
            return;
          }
          activeVoiceRecognitionRef.current = null;
          setIsVoiceListening(false);
          isVoiceListeningRef.current = false;
        };

        recognition.start();
      } catch (e) {
        console.warn('Recognition start error:', e);
        activeVoiceRecognitionRef.current = null;
      }
    };

    let pendingCommand = '';
    let micStarted = false;
    const safeStartMic = () => {
      if (micStarted || voiceAssistantIsClosingRef.current || !isVoiceListeningRef.current) return;
      micStarted = true;
      startMicrophoneRecognition();
    };

    const isPromptExamSession = Boolean((currentExam || isExamActive) && !examSubmitted && (activeTab === 'AI Exam Assistant' || activeTab === 'Active Exam' || isExamActive));
    const isPromptVivaSession = Boolean(activeTab === 'AI Oral Viva Simulator');
    const isPromptStudyPracticeSession = Boolean(activeTab === 'Study Materials' && activePracticeMat);
    const isPromptStudyTestSession = Boolean(activeTab === 'Study Materials' && activeLessonTest);

    let promptText = "";
    if (isPromptExamSession) {
      const hasAnswer = Boolean((currentAnswerInputRef.current || currentAnswerInput || '').trim());
      const totalQ = currentExam?.questions?.length || 1;
      const isLastQ = currentQIndex >= totalQ - 1;
      if (hasAnswer) {
        promptText = "Say your command: repeat answer, or to say answer again, or next question, or repeat question, or submit.";
      } else if (isLastQ) {
        promptText = "Say repeat question, or next question, or say your answer, and say submit.";
      } else {
        promptText = "Say your answer, or say repeat question, or next question, or say your answer again.";
      }
    } else if (isPromptVivaSession) {
      const activeVivaList = resolveCurrentVivaList();
      const totalVivaQ = activeVivaList.length || 1;
      const curVivaQIdx = activeVivaList.length > 0 ? (vivaQIndex % activeVivaList.length) : 0;
      const hasVivaAnswer = Boolean((vivaAnswerInput || vivaAnswersRecord[curVivaQIdx] || '').trim());
      const isLastVivaQ = curVivaQIdx >= totalVivaQ - 1;
      if (hasVivaAnswer) {
        promptText = "Say your command: repeat answer, or to say answer again, or next question, or repeat question, or submit.";
      } else if (isLastVivaQ) {
        promptText = "Say repeat question, or next question, or say your answer, and say submit.";
      } else {
        promptText = "Say your answer and say done when the answer finish, or say repeat question, or next question, or say your answer.";
      }
    } else if (isPromptStudyPracticeSession) {
      const questionsList = (activePracticeMat.questions && activePracticeMat.questions.length > 0)
        ? activePracticeMat.questions
        : [{ text: activePracticeMat.practiceQuestion || activePracticeMat.title }];
      const totalQ = questionsList.length;
      const safeQIdx = Math.min(practiceQIdx, totalQ - 1);
      const hasPracticeAnswer = Boolean((practiceAnswerInput || practiceAnswersByQ[safeQIdx] || '').trim());
      const isLastPracticeQ = safeQIdx >= totalQ - 1;
      if (hasPracticeAnswer) {
        promptText = "Say your command: repeat answer, or to say answer again, or next question, or repeat question, or submit.";
      } else if (isLastPracticeQ) {
        promptText = "Say repeat question, or next question, or say your answer, and say submit.";
      } else {
        promptText = "Say your answer, or say repeat question, or next question, or repeat your answer.";
      }
    } else if (isPromptStudyTestSession) {
      const totalTestQ = activeLessonTest.questions?.length || 1;
      const isLastTestQ = lessonTestQIndex >= totalTestQ - 1;
      const hasTestAnswer = Boolean((lessonTestInput || lessonTestAnswers[activeLessonTest.questions?.[lessonTestQIndex]?.id] || '').trim());
      if (hasTestAnswer) {
        promptText = "Say your command: repeat answer, or to say answer again, or next question, or repeat question, or submit.";
      } else if (isLastTestQ) {
        promptText = "Say repeat question, or next question, or say your answer, and say submit.";
      } else {
        promptText = "Say your answer, or say repeat question, or next question, or repeat your answer.";
      }
    } else if (activeTab === 'Study Materials') {
      promptText = "Study Materials and Audio Lessons. Say Listen Lesson to hear audio lessons, or say Practice with Voice AI, or take lesson test.";
    } else if (activeTab === 'My Exams' || (activeTab === 'AI Exam Assistant' && !currentExam)) {
      promptText = "Written Exams portal. Say START EXAM to start writing your exam, or choose an exam to begin.";
    } else {
      promptText = "Listening. What help can I do for you? Say your command, or say speak all features, or tell me your interested subject.";
    }

    const promptSpeechLang = 'en-US';

    speakIn(promptText, promptSpeechLang, {
      onEnd: safeStartMic
    });

    if (voiceFallbackTimeoutRef.current) clearTimeout(voiceFallbackTimeoutRef.current);
    const fallbackTimeout = Math.min(2000, Math.max(900, promptText.length * 30));
    voiceFallbackTimeoutRef.current = setTimeout(safeStartMic, fallbackTimeout);
  };

  const handleDashboardGlobalClick = (e) => {
    if (
      !isVoiceAssistantEnabled ||
      e.target.closest('input') || 
      e.target.closest('button') || 
      e.target.closest('a') || 
      e.target.closest('textarea') || 
      e.target.closest('select') || 
      e.target.closest('[role="button"]') ||
      isVoiceProfileWizardOpen
    ) {
      return;
    }
    triggerVoiceCommand(true);
  };

  // Initial Voice Welcome Greeting on Dashboard mount
  useEffect(() => {
    try {
      // Purge any unpublished mock materials from localStorage
      const savedMat = localStorage.getItem('shared_study_materials');
      if (savedMat) {
        const parsedM = JSON.parse(savedMat);
        if (Array.isArray(parsedM)) {
          const cleanedM = parsedM.filter(m => 
            !(m.id === 1 && m.title === 'Physics: Motion & Laws of Force') && 
            !(m.id === 2 && m.title === 'Computer Networks: OSI Model & Protocols') && 
            !(m.id === 3 && m.title === 'Mathematics: Algebra & Equations') &&
            !(m.id === 1 && m.title === 'Computer Networks OSI Layer Guide (PDF)') &&
            !(m.id === 2 && m.title === 'OS Deadlocks Audio Lecture & Voice Notes') &&
            !(m.id === 3 && m.title === 'Cyber Security Phishing Defense Book')
          );
          const strictlyNoMcq = sanitizeStudyMaterialList(cleanedM);
          localStorage.setItem('shared_study_materials', JSON.stringify(strictlyNoMcq));
          setStudyMaterials(strictlyNoMcq);
        }
      }
    } catch (e) {}
  }, []);

  // Emergency SOS Dispatch Handler
  const handleEmergencyAssistAlert = () => {
    const alertData = {
      id: Date.now(),
      studentName: student.name,
      studentId: student.studentId,
      examTitle: currentExam ? currentExam.title : 'General Platform Navigation',
      request: '🚨 Emergency SOS triggered by student. Requires immediate audio assist.',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'Pending'
    };

    try {
      const existing = JSON.parse(localStorage.getItem('shared_assistance_requests') || '[]');
      localStorage.setItem('shared_assistance_requests', JSON.stringify([alertData, ...existing]));
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('sos_alert', { detail: alertData }));
      postAssistanceRequest(alertData).catch(() => {});
    } catch (e) {}

    announce("🚨 Emergency SOS Alert dispatched to Teacher and Admin Command Center!");
    speakText("Emergency assistance alert sent to your teacher and administrator. Help is on the way.");
  };



  // Dynamic Viva Question Banks (Populated from filteredOralVivas)
  const dynamicVivaBank = {};
  if (Array.isArray(filteredOralVivas) && filteredOralVivas.length > 0) {
    filteredOralVivas.forEach(v => {
      const qList = (v.questions && v.questions.length > 0) ? v.questions.map((q, idx) => ({
        id: q.id || idx + 1,
        text: q.text,
        keywords: Array.isArray(q.keywords) 
          ? q.keywords.map(k => String(k).trim().toLowerCase())
          : (typeof q.keywords === 'string' ? q.keywords.split(',').map(k => k.trim().toLowerCase()) : ['concept', 'core principle', 'architecture'])
      })) : [
        { id: 1, text: `Explain the fundamental concepts and practical application of ${v.title || v.subject || 'this topic'}.`, keywords: ['concepts', 'principles', 'workflow'] }
      ];

      if (v.subject) dynamicVivaBank[v.subject] = qList;
      if (v.title) dynamicVivaBank[v.title] = qList;
      if (v.id) dynamicVivaBank[String(v.id)] = qList;
      if (v.title && v.subject) dynamicVivaBank[`${v.title} (${v.subject})`] = qList;
    });
  }

  // Dynamic Lookup with filtered vivas
  const resolveCurrentVivaList = () => {
    if (!Array.isArray(filteredOralVivas) || filteredOralVivas.length === 0) return [];
    if (vivaSubject && dynamicVivaBank[vivaSubject]) return dynamicVivaBank[vivaSubject];
    const sLower = String(vivaSubject || '').toLowerCase().trim();
    const matchedKey = Object.keys(dynamicVivaBank).find(k => {
      const kLower = k.toLowerCase().trim();
      return kLower === sLower || kLower.includes(sLower) || sLower.includes(kLower);
    });
    if (matchedKey && dynamicVivaBank[matchedKey]) return dynamicVivaBank[matchedKey];
    const firstViva = filteredOralVivas[0];
    return dynamicVivaBank[firstViva.title] || dynamicVivaBank[firstViva.subject] || (firstViva.questions || []);
  };

  const currentVivaQList = resolveCurrentVivaList();
  const activeVivaQIdx = currentVivaQList.length > 0 ? (vivaQIndex % currentVivaQList.length) : 0;
  const currentVivaQ = currentVivaQList.length > 0 ? (currentVivaQList[activeVivaQIdx] || currentVivaQList[0]) : null;

  const stopVivaDictation = (speakBack = true) => {
    isVivaDictatingRef.current = false;
    setIsVivaDictating(false);
    if (vivaRecognitionRef.current) {
      try { vivaRecognitionRef.current.stop(); } catch (e) {}
      vivaRecognitionRef.current = null;
    }
    const cleanText = (vivaAnswerInput || '').trim();
    if (speakBack && cleanText) {
      setVivaAnswersRecord(prev => ({ ...prev, [activeVivaQIdx]: cleanText }));
      lastSpokenVivaAnswerRef.current = cleanText;
      const promptText = `You answered: "${cleanText}". Say your command: repeat answer, or to say answer again, or next question, or repeat question, or submit.`;
      speakText(promptText);
    }
  };

  const startVivaDictation = (speakPrompt = true) => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      speakText("Speech recognition is not supported in this browser. Please type your answer.");
      return;
    }

    if (vivaRecognitionRef.current) {
      try { vivaRecognitionRef.current.abort(); } catch (e) {}
      vivaRecognitionRef.current = null;
    }

    isVivaDictatingRef.current = true;
    setIsVivaDictating(true);
    cancelSpeech();

    const doStartRec = () => {
      if (!isVivaDictatingRef.current) return;
      try {
        const rec = new SpeechRecognition();
        rec.lang = 'en-US';
        rec.continuous = true;
        rec.interimResults = true;
        vivaRecognitionRef.current = rec;

        rec.onstart = () => {
          setIsVivaDictating(true);
          isVivaDictatingRef.current = true;
        };

        rec.onresult = (e) => {
          if (isTTSActive()) return;
          let currentTranscript = '';
          for (let i = 0; i < e.results.length; i++) {
            currentTranscript += e.results[i][0].transcript;
          }
          const cleaned = currentTranscript.trim();
          setLiveVoiceTranscript(cleaned);
          const lower = cleaned.toLowerCase();

          // 1. Repeat Answer Command
          if (/\b(repeat answer|repeat my answer|re-record|change answer|try again)\b/i.test(lower) || (lower === 'repeat' && vivaAnswerInput)) {
            isVivaDictatingRef.current = false;
            setIsVivaDictating(false);
            try { rec.stop(); } catch (err) {}
            vivaRecognitionRef.current = null;
            setVivaAnswerInput('');
            setVivaAnswersRecord(prev => ({ ...prev, [activeVivaQIdx]: '' }));
            lastSpokenVivaAnswerRef.current = '';
            speakText("Clearing previous answer. Please speak your answer again now.", () => {
              setTimeout(() => {
                startVivaDictation(false);
              }, 300);
            });
            return;
          }

          // 2. Repeat Question Command
          if (/\b(repeat question|read question|say question|what is the question|read the question)\b/i.test(lower) || (lower === 'repeat' && !vivaAnswerInput)) {
            isVivaDictatingRef.current = false;
            setIsVivaDictating(false);
            try { rec.stop(); } catch (err) {}
            vivaRecognitionRef.current = null;
            handleRepeatVivaQuestion();
            return;
          }

          // 3. Next Question Command
          if (/\b(next question|next q|go to next|proceed|save and next)\b/i.test(lower) || lower === 'next') {
            isVivaDictatingRef.current = false;
            setIsVivaDictating(false);
            try { rec.stop(); } catch (err) {}
            vivaRecognitionRef.current = null;
            handleNextVivaQuestion();
            return;
          }

          // 4. Previous Question Command
          if (/\b(previous question|prev question|go back|back)\b/i.test(lower) || lower === 'previous') {
            isVivaDictatingRef.current = false;
            setIsVivaDictating(false);
            try { rec.stop(); } catch (err) {}
            vivaRecognitionRef.current = null;
            handlePrevVivaQuestion();
            return;
          }

          // 5. Submit Viva Exam Command
          if (/\b(submit viva|submit exam|finish viva|finish exam)\b/i.test(lower) || lower === 'submit') {
            isVivaDictatingRef.current = false;
            setIsVivaDictating(false);
            try { rec.stop(); } catch (err) {}
            vivaRecognitionRef.current = null;
            handleSubmitVivaExam();
            return;
          }

          // 6. Dictation done check
          const { isDone, cleanText } = parseDoneTrigger(cleaned);
          setVivaAnswerInput(cleanText);

          if (isDone) {
            isVivaDictatingRef.current = false;
            setIsVivaDictating(false);
            try { rec.stop(); } catch (err) {}
            vivaRecognitionRef.current = null;

            setVivaAnswersRecord(prev => ({ ...prev, [activeVivaQIdx]: cleanText }));
            lastSpokenVivaAnswerRef.current = cleanText;

            const promptText = `You answered: "${cleanText}". Say your command: repeat answer, or to say answer again, or next question, or repeat question, or submit.`;
            speakText(promptText);
          }
        };

        rec.onerror = (e) => {
          console.warn('Viva dictation recognition error:', e);
        };

        rec.onend = () => {
          if (isVivaDictatingRef.current) {
            try {
              rec.start();
            } catch (err) {
              setTimeout(() => {
                if (isVivaDictatingRef.current) {
                  try { rec.start(); } catch (e) {}
                }
              }, 300);
            }
          }
        };

        rec.start();
      } catch (err) {
        console.error('Failed to start speech recognition for viva:', err);
      }
    };

    if (speakPrompt) {
      speakText("Listening for your viva answer. Speak your answer now, and say DONE when you are finished.", () => {
        setTimeout(doStartRec, 150);
      });
    } else {
      doStartRec();
    }
  };

  const handleAnswerBoxFocusOrClick = () => {
    if (!isVivaDictatingRef.current) {
      startVivaDictation();
    }
  };

  const handleVivaTextareaBlur = () => {
    const text = (vivaAnswerInput || '').trim();
    if (text && text !== lastSpokenVivaAnswerRef.current && !isVivaDictatingRef.current) {
      lastSpokenVivaAnswerRef.current = text;
      setVivaAnswersRecord(prev => ({ ...prev, [activeVivaQIdx]: text }));
      speakText(`You typed: ${text}. Answer recorded. You can say repeat question, next question, or submit viva.`);
    }
  };

  const handleVivaTextareaKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const text = (vivaAnswerInput || '').trim();
      if (text && text !== lastSpokenVivaAnswerRef.current) {
        lastSpokenVivaAnswerRef.current = text;
        setVivaAnswersRecord(prev => ({ ...prev, [activeVivaQIdx]: text }));
        speakText(`You typed: ${text}. Answer recorded. You can say repeat question, next question, or submit viva.`);
      }
    }
  };

  const handleRepeatVivaQuestion = () => {
    if (!currentVivaQ) return;
    const msg = `Question ${activeVivaQIdx + 1} of ${currentVivaQList.length}: ${currentVivaQ.text}. Tap Answer by Voice to speak your answer.`;
    speakText(msg);
  };

  const handleNextVivaQuestion = () => {
    if (isVivaDictatingRef.current) {
      isVivaDictatingRef.current = false;
      setIsVivaDictating(false);
      if (vivaRecognitionRef.current) {
        try { vivaRecognitionRef.current.abort(); } catch (e) {}
      }
    }

    const currentAns = (vivaAnswerInput || '').trim();
    if (currentAns) {
      setVivaAnswersRecord(prev => ({ ...prev, [activeVivaQIdx]: currentAns }));
    }

    const nextIdx = activeVivaQIdx + 1;
    if (nextIdx < currentVivaQList.length) {
      setVivaQIndex(nextIdx);
      const existingNextAns = vivaAnswersRecord[nextIdx] || '';
      setVivaAnswerInput(existingNextAns);
      lastSpokenVivaAnswerRef.current = existingNextAns;
      setVivaFeedback(null);
      const nextQ = currentVivaQList[nextIdx];
      const prefix = currentAns ? `Your answer was: "${currentAns}". Answer saved. ` : '';
      const msg = `${prefix}Moving to Question ${nextIdx + 1} of ${currentVivaQList.length}: ${nextQ.text}. ${existingNextAns ? 'Your recorded answer is: ' + existingNextAns : 'Tap Answer by Voice to speak your answer.'}`;
      speakText(msg);
    } else {
      speakText(`You are on the last question of this viva exam. Say 'Submit Viva' or click Submit Viva Exam to complete your assessment.`);
    }
  };

  const handlePrevVivaQuestion = () => {
    if (activeVivaQIdx <= 0) {
      speakText("You are on the first question.");
      return;
    }
    if (isVivaDictatingRef.current) {
      isVivaDictatingRef.current = false;
      setIsVivaDictating(false);
      if (vivaRecognitionRef.current) {
        try { vivaRecognitionRef.current.abort(); } catch (e) {}
      }
    }

    const currentAns = (vivaAnswerInput || '').trim();
    if (currentAns) {
      setVivaAnswersRecord(prev => ({ ...prev, [activeVivaQIdx]: currentAns }));
    }

    const prevIdx = activeVivaQIdx - 1;
    setVivaQIndex(prevIdx);
    const existingPrevAns = vivaAnswersRecord[prevIdx] || '';
    setVivaAnswerInput(existingPrevAns);
    lastSpokenVivaAnswerRef.current = existingPrevAns;
    setVivaFeedback(null);
    const prevQ = currentVivaQList[prevIdx];
    const msg = `Previous question. Question ${prevIdx + 1} of ${currentVivaQList.length}: ${prevQ.text}. ${existingPrevAns ? 'Your recorded answer is: ' + existingPrevAns : 'Tap the answer box to speak your answer.'}`;
    speakText(msg);
  };

  const handleSubmitVivaExam = () => {
    if (isVivaDictatingRef.current) {
      isVivaDictatingRef.current = false;
      setIsVivaDictating(false);
      if (vivaRecognitionRef.current) {
        try { vivaRecognitionRef.current.abort(); } catch (e) {}
      }
    }

    const currentAns = (vivaAnswerInput || '').trim();
    const updatedAnswers = {
      ...vivaAnswersRecord,
      ...(currentAns ? { [activeVivaQIdx]: currentAns } : {})
    };
    setVivaAnswersRecord(updatedAnswers);

    // User requirement: Say the answer entered upon completion and do not evaluate (evaluated by teacher)
    const ansToSpeak = currentAns || updatedAnswers[activeVivaQIdx] || updatedAnswers[0] || 'No answer entered';
    speakText(`You entered: ${ansToSpeak}. Your viva exam has been successfully submitted to your teacher for manual evaluation.`);

    const currentViva = (filteredOralVivas && filteredOralVivas.length > 0)
      ? (filteredOralVivas.find(v => v.title === vivaSubject || v.subject === vivaSubject || String(v.id) === vivaSubject) || filteredOralVivas[0])
      : { title: vivaSubject || `${activeSubject} Oral Viva`, subject: activeSubject };

    const studentEmail = (student.email || studentProfile.email || '').toLowerCase().trim();
    const studentName = student.name || studentProfile.name || 'Student';

    let targetTeacherEmail = (currentViva.teacherEmail || currentViva.creatorEmail || '').toLowerCase().trim();
    let targetTeacherName = currentViva.teacherName || '';
    if (!targetTeacherEmail || !targetTeacherName) {
      try {
        const loggedMap = JSON.parse(localStorage.getItem('logged_in_users') || '{}');
        const teachersList = Object.values(loggedMap).filter(u => u.role === 'teacher' && (u.name || u.email));
        const subjTeacher = teachersList.find(t => isSubjectMatching(t.subject, currentViva.subject || activeSubject)) || teachersList[0];
        if (subjTeacher) {
          if (!targetTeacherEmail && subjTeacher.email) targetTeacherEmail = subjTeacher.email.toLowerCase().trim();
          if (!targetTeacherName && subjTeacher.name) targetTeacherName = subjTeacher.name;
        }
      } catch (e) {}
    }
    if (!targetTeacherEmail || !targetTeacherName) {
      try {
        const sharedTeachers = JSON.parse(localStorage.getItem('shared_teachers_list') || '[]');
        const subjTeacher = sharedTeachers.find(t => isSubjectMatching(t.subject, currentViva.subject || activeSubject)) || sharedTeachers[0];
        if (subjTeacher) {
          if (!targetTeacherEmail && subjTeacher.email) targetTeacherEmail = subjTeacher.email.toLowerCase().trim();
          if (!targetTeacherName && (subjTeacher.name || subjTeacher.fullName)) targetTeacherName = subjTeacher.name || subjTeacher.fullName;
        }
      } catch (e) {}
    }
    if (!targetTeacherEmail) targetTeacherEmail = 'teacher@school.edu';
    if (!targetTeacherName) targetTeacherName = 'Teacher';

    const submissionObj = {
      id: `viva_sub_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      vivaId: currentViva.id || `viva_${Date.now()}`,
      vivaTitle: currentViva.title || vivaSubject || `${activeSubject} Oral Viva`,
      subject: currentViva.subject || activeSubject,
      student: studentName,
      studentName: studentName,
      studentEmail: studentEmail,
      teacherEmail: targetTeacherEmail,
      teacherName: targetTeacherName,
      isBroadcast: true,
      submittedAt: new Date().toISOString(),
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'Pending Teacher Evaluation',
      response: ansToSpeak,
      spokenResponse: ansToSpeak,
      questions: currentVivaQList.map((q, idx) => ({
        questionNum: idx + 1,
        questionId: q.id,
        questionText: q.text,
        studentAnswer: (updatedAnswers[idx] || '').trim() || 'No answer submitted',
        expectedAnswer: q.answer || q.expectedAnswer || '',
        keywords: q.keywords || []
      })),
      totalQuestions: currentVivaQList.length,
      teacherScore: null,
      gradeStatus: 'Pending Evaluation',
      teacherFeedback: '',
      evaluatedAt: null
    };

    try {
      const rawSubs = localStorage.getItem('shared_viva_submissions');
      const existingSubs = rawSubs ? JSON.parse(rawSubs) : [];
      const otherSubs = Array.isArray(existingSubs) ? existingSubs.filter(s => 
        !(s && s.studentEmail === studentEmail && (s.vivaTitle === submissionObj.vivaTitle || s.vivaId === submissionObj.vivaId || s.subject === submissionObj.subject))
      ) : [];
      const nextSubs = [submissionObj, ...otherSubs];
      localStorage.setItem('shared_viva_submissions', JSON.stringify(nextSubs));
      setVivaSubmissionsList(nextSubs);

      const notifObj = {
        id: `notif_${Date.now()}`,
        title: `🎙️ New Viva Submission: ${studentName}`,
        detail: `${studentName} has submitted oral viva for ${submissionObj.subject} (${submissionObj.vivaTitle}). Awaiting your manual evaluation.`,
        date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ', ' + new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        type: 'Oral Viva',
        teacherEmail: targetTeacherEmail,
        read: false
      };
      const rawNotifs = localStorage.getItem('shared_notifications');
      const existingNotifs = rawNotifs ? JSON.parse(rawNotifs) : [];
      localStorage.setItem('shared_notifications', JSON.stringify([notifObj, ...existingNotifs]));

      window.dispatchEvent(new Event('storage'));
    } catch (e) {}

    setVivaOverallResult(submissionObj);
    setIsVivaSubmitted(true);
  };

  const handleRestartViva = () => {
    setIsVivaSubmitted(false);
    setVivaOverallResult(null);
    setVivaQIndex(0);
    setVivaAnswerInput('');
    setVivaAnswersRecord({});
    setVivaFeedback(null);
    lastSpokenVivaAnswerRef.current = '';

    try {
      const studentEmail = (student.email || studentProfile.email || '').toLowerCase().trim();
      const rawSubs = localStorage.getItem('shared_viva_submissions');
      if (rawSubs) {
        const parsed = JSON.parse(rawSubs);
        const filtered = Array.isArray(parsed) ? parsed.filter(s => 
          !(s && s.studentEmail === studentEmail && (s.vivaTitle === vivaSubject || s.subject === activeSubject))
        ) : [];
        localStorage.setItem('shared_viva_submissions', JSON.stringify(filtered));
        setVivaSubmissionsList(filtered);
        window.dispatchEvent(new Event('storage'));
      }
    } catch (e) {}

    const firstQ = currentVivaQList[0];
    const msg = `Restarting viva exam for ${vivaSubject || activeSubject}. Question 1 of ${currentVivaQList.length}: ${firstQ?.text || ''}. Tap the answer box to speak your answer.`;
    speakText(msg);
  };

  const handleEvaluateViva = () => {
    speakText("Oral viva exams are evaluated manually by your teacher. Tap the answer box to speak your answer, and click Submit Viva Exam when you are finished.");
  };

  const handleEvaluatePractice = (overrideAns) => {
    if (!activePracticeMat) return;
    const studentAns = (overrideAns !== undefined ? overrideAns : (practiceAnswerInput || '')).trim();
    if (!studentAns) {
      speakText("Please speak or type your practice answer before evaluation.");
      return;
    }

    const questionsList = (activePracticeMat.questions && activePracticeMat.questions.length > 0)
      ? activePracticeMat.questions
      : [{
          id: 1,
          text: activePracticeMat.practiceQuestion || `Explain core concepts of ${activePracticeMat.title}`,
          oneLineAnswer: activePracticeMat.oneLineAnswer || activePracticeMat.practiceAnswer || activePracticeMat.correctAnswer || activePracticeMat.detail,
          explanation: activePracticeMat.explanation || activePracticeMat.textContent
        }];
    const safeQIdx = Math.min(practiceQIdx, questionsList.length - 1);
    const currentQ = questionsList[safeQIdx] || questionsList[0];

    const expectedShort = (currentQ.oneLineAnswer || currentQ.correctAnswer || currentQ.answer || activePracticeMat.oneLineAnswer || activePracticeMat.practiceAnswer || activePracticeMat.correctAnswer || activePracticeMat.detail || '').trim();
    const expectedLong = (currentQ.explanation || activePracticeMat.explanation || activePracticeMat.textContent || activePracticeMat.detail || '').trim();
    const targetRefText = `${expectedShort} ${expectedLong} ${activePracticeMat.title || ''}`.toLowerCase();

    // 1. Detect gibberish / nonsense input (e.g., 'asdfghjkl', keyboard mashing, repeated characters)
    const lowerAns = studentAns.toLowerCase();
    const isKeyboardRowMash = /(?:asdf|sdfg|dfgh|fghj|ghjk|hjkl|jkl;|qwerty|werty|ertyu|rtyui|tyuio|yuio|zxcv|xcvb|cvbn|vbnm)/i.test(lowerAns);
    const hasRepeatedChars = /(.)\1{3,}/.test(lowerAns);
    const cleanWordTokens = lowerAns.replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter(Boolean);
    const wordsWithVowels = cleanWordTokens.filter(w => /[aeiouy]/.test(w));
    const isVowellessGibberish = cleanWordTokens.length > 0 && wordsWithVowels.length === 0;

    const stopWords = new Set([
      'the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'in', 'of', 'to', 'for', 'with', 'it', 'this', 
      'that', 'as', 'by', 'from', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 
      'does', 'did', 'but', 'not', 'you', 'your', 'my', 'their', 'our', 'what', 'when', 'where', 'who', 'how', 
      'why', 'can', 'could', 'should', 'would', 'will', 'shall', 'then', 'so', 'just', 'more', 'about', 'some',
      'there', 'their', 'all', 'any', 'into', 'also', 'such', 'than', 'over', 'after', 'before'
    ]);

    // Extract significant keywords from expected answer
    const refTokens = targetRefText.replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter(w => w.length >= 3 && !stopWords.has(w));
    const uniqueRefKeywords = Array.from(new Set(refTokens));

    // Extract significant keywords from student answer
    const studentTokens = cleanWordTokens.filter(w => w.length >= 3 && !stopWords.has(w));
    const uniqueStudentKeywords = Array.from(new Set(studentTokens));

    // Match keywords
    const keywordsFound = [];
    uniqueRefKeywords.forEach(kw => {
      if (uniqueStudentKeywords.some(sw => sw.includes(kw) || kw.includes(sw) || (sw.length > 4 && kw.startsWith(sw.slice(0, 4))))) {
        keywordsFound.push(kw);
      }
    });

    const isGibberish = isKeyboardRowMash || hasRepeatedChars || isVowellessGibberish;

    let score = 0;
    let feedbackMsg = "";
    const matchedCount = keywordsFound.length;
    const refCount = Math.max(1, uniqueRefKeywords.length);
    const matchRatio = matchedCount / refCount;

    if (isGibberish || cleanWordTokens.length === 0) {
      score = 0;
      feedbackMsg = "Incorrect answer. Your response appears to be unrecognized text or random typing. Please speak the definition or explanation accurately.";
    } else if (matchedCount === 0) {
      score = 1;
      feedbackMsg = "Incorrect answer. Your response did not cover any key concepts or definitions for this question. Review the teacher's reference answer.";
    } else if (matchedCount === 1 && matchRatio < 0.25) {
      score = 3;
      feedbackMsg = `Partial attempt. You mentioned "${keywordsFound[0]}", but missed other core concepts from the study material.`;
    } else if (matchRatio < 0.4 || matchedCount < 3) {
      score = 5;
      feedbackMsg = `Fair attempt. You mentioned key ideas like ${keywordsFound.slice(0, 3).join(', ')}. Review the teacher's reference answer to cover all points.`;
    } else if (matchRatio < 0.7 || matchedCount < 5) {
      score = 7;
      feedbackMsg = `Good practice attempt! You covered important concepts: ${keywordsFound.slice(0, 4).join(', ')}.`;
    } else if (matchRatio < 0.85) {
      score = 9;
      feedbackMsg = "Excellent response! Outstanding clarity and accurate conceptual understanding covering all core definitions.";
    } else {
      score = 10;
      feedbackMsg = "Perfect answer! Comprehensive and precise coverage of the entire study material concept.";
    }

    const expectedAns = expectedShort || activePracticeMat.practiceAnswer || activePracticeMat.detail;
    const evalResult = {
      score,
      status: score >= 8 ? 'Excellent' : score >= 5 ? 'Good Effort' : 'Needs Improvement',
      feedbackMsg,
      keywordsFound,
      expectedAns
    };

    setPracticeFeedback(evalResult);

    const voiceStatus = score >= 8 ? 'Excellent.' : score >= 5 ? 'Good effort.' : 'Needs improvement.';
    speakText(`Voice Practice Score: ${score} out of 10. ${voiceStatus} ${feedbackMsg} Teacher's expected reference answer is: ${expectedAns}`);
  };

  // Braille Simulator State (6 Dots)
  const [brailleDots, setBrailleDots] = useState([false, false, false, false, false, false]);
  const toggleBrailleDot = (idx) => {
    const next = [...brailleDots];
    next[idx] = !next[idx];
    setBrailleDots(next);

    const activeDotsStr = next.map((val, i) => val ? (i + 1) : null).filter(Boolean).join(', ');
    if (activeDotsStr) speakText(`Braille dot ${idx + 1} ${next[idx] ? 'selected' : 'cleared'}. Active dots: ${activeDotsStr}`);
  };

  return (
    <div 
      onClick={handleDashboardGlobalClick}
      style={{ display: 'flex', minHeight: '100vh', background: accessibility.highContrast ? '#000000' : '#f8fafc', color: accessibility.highContrast ? '#ffff00' : '#0f172a', fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      
      {/* COMPULSORY AI FACIAL VERIFICATION & PROCTORING GATE MODAL */}
      {faceAuthModalOpen && (
        <div 
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(10px)',
            zIndex: 999999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#ffffff',
              borderRadius: '24px',
              border: faceDetected ? '3px solid #22c55e' : (!studentProfile.profilePic || (faceConfidence > 0 && faceConfidence < 50)) ? '3px solid #ef4444' : '3px solid #0284c7',
              maxWidth: '580px',
              width: '100%',
              padding: '28px 32px',
              textAlign: 'center',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.45)',
              position: 'relative'
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <span style={{ fontSize: '11px', background: faceDetected ? '#dcfce7' : (studentProfile.profilePic && faceConfidence >= 50) ? '#e0f2fe' : '#fee2e2', color: faceDetected ? '#15803d' : (studentProfile.profilePic && faceConfidence >= 50) ? '#0369a1' : '#b91c1c', padding: '4px 12px', borderRadius: '12px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                🛡️ Mandatory Candidate Face Scanner
              </span>
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '700' }}>
                Continuous Exam Proctoring
              </span>
            </div>

            <h2 style={{ fontSize: '22px', fontWeight: '900', color: '#0f172a', margin: '0 0 6px 0' }}>
              Candidate Multi-Angle Face Biometric Scanner
            </h2>
            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#64748b', lineHeight: 1.4 }}>
              Candidate: <b>{student.name}</b> (Reg: {student.studentId}) • Exam: <b>{pendingExamToStart?.title || 'Exam'}</b>
            </p>

            <div>
              {/* Reference Info Bar */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '10px 16px', borderRadius: '14px', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', overflow: 'hidden', border: studentProfile.profilePic ? '2px solid #0284c7' : '2px solid #ef4444', flexShrink: 0, background: studentProfile.profilePic ? '#e0f2fe' : '#fee2e2', display: 'grid', placeItems: 'center' }}>
                    {studentProfile.profilePic ? (
                      <img src={studentProfile.profilePic} alt="Enrolled" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontSize: '18px' }}>👤</span>
                    )}
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <b style={{ fontSize: '12px', color: '#0f172a', display: 'block' }}>Candidate: {student.name}</b>
                    <small style={{ fontSize: '11px', color: studentProfile.profilePic ? '#64748b' : '#b91c1c', fontWeight: studentProfile.profilePic ? 'normal' : 'bold' }}>
                      {studentProfile.profilePic ? 'Verifying live webcam against registered profile photo' : '⚠️ Profile photo missing! Register photo before taking exam.'}
                    </small>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ 
                    fontSize: '12px', 
                    fontWeight: '900', 
                    color: faceDetected ? '#15803d' : !studentProfile.profilePic ? '#b91c1c' : (faceConfidence >= 46) ? '#15803d' : (faceConfidence > 0) ? '#d97706' : '#0284c7' 
                  }}>
                    {faceDetected 
                      ? '✓ Locked & Enrolled' 
                      : !studentProfile.profilePic 
                        ? '🔴 Profile Photo Required' 
                        : (faceConfidence >= 46) 
                          ? `✓ Match: ${faceConfidence}%` 
                          : (faceConfidence > 0)
                            ? `⏳ Aligning: ${faceConfidence}%`
                            : '🎯 Position Face'}
                  </span>
                </div>
              </div>

              {/* Instant Profile Photo Register Button if Missing */}
              {!studentProfile.profilePic && (
                <div style={{ marginBottom: '14px' }}>
                  <button
                    type="button"
                    onClick={handleEnrollProfilePhotoFromExamModal}
                    style={{
                      background: '#0284c7',
                      color: '#ffffff',
                      border: 'none',
                      padding: '10px 18px',
                      borderRadius: '10px',
                      fontWeight: '800',
                      fontSize: '13px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: '0 2px 8px rgba(2, 132, 199, 0.3)'
                    }}
                  >
                    📸 Capture & Register Official Profile Photo Now
                  </button>
                </div>
              )}

              {faceErrorMessage ? (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '12px', borderRadius: '12px', color: '#b91c1c', fontSize: '12px', fontWeight: '700', marginBottom: '14px' }}>
                  ⚠️ {faceErrorMessage}
                </div>
              ) : null}

              {/* Webcam Clarity & Lighting Controls */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', padding: '0 4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: '700' }}>
                  <span style={{ 
                    display: 'inline-flex', alignItems: 'center', gap: '5px',
                    color: cameraLightingFeedback === 'low' ? '#d97706' : cameraLightingFeedback === 'overexposed' ? '#d97706' : '#15803d' 
                  }}>
                    {cameraLightingFeedback === 'low' 
                      ? '💡 Low Light: Software Auto-Boost Active' 
                      : cameraLightingFeedback === 'overexposed' 
                        ? '☀️ High Backlight: Exposure Compensated' 
                        : '✨ Lighting Quality: Clear & Optimal'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setCameraClarityBoost(prev => !prev)}
                  title="Toggle crystal clear contrast and brightness booster"
                  style={{
                    background: cameraClarityBoost ? 'linear-gradient(135deg, #0284c7, #0369a1)' : '#f1f5f9',
                    color: cameraClarityBoost ? '#ffffff' : '#475569',
                    border: 'none',
                    padding: '5px 12px',
                    borderRadius: '8px',
                    fontSize: '11px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    boxShadow: cameraClarityBoost ? '0 2px 6px rgba(2, 132, 199, 0.35)' : 'none',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {cameraClarityBoost ? '✨ HD Clarity: ON' : '✨ HD Clarity: OFF'}
                </button>
              </div>

              {/* 3-Step Multi-Angle Enrollment Indicator (Center -> Left -> Right) */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '8px',
                marginBottom: '14px'
              }}>
                <div style={{
                  background: scannedAnglesState.center ? '#f0fdf4' : faceScanStage === 'center' ? '#eff6ff' : '#f8fafc',
                  border: scannedAnglesState.center ? '2px solid #22c55e' : faceScanStage === 'center' ? '2px solid #0284c7' : '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '8px 10px',
                  textAlign: 'center',
                  transition: 'all 0.3s ease'
                }}>
                  <div style={{ fontSize: '11px', fontWeight: '800', color: scannedAnglesState.center ? '#15803d' : faceScanStage === 'center' ? '#0369a1' : '#64748b' }}>
                    👤 Step 1: Center {scannedAnglesState.center ? '✓' : faceScanStage === 'center' ? '●' : '○'}
                  </div>
                  <div style={{ fontSize: '10px', color: scannedAnglesState.center ? '#16a34a' : '#94a3b8', marginTop: '2px', fontWeight: '600' }}>
                    {scannedAnglesState.center ? 'Locked ✓' : faceScanStage === 'center' ? 'Look Straight' : 'Pending'}
                  </div>
                </div>

                <div style={{
                  background: scannedAnglesState.left ? '#f0fdf4' : faceScanStage === 'left' ? '#eff6ff' : '#f8fafc',
                  border: scannedAnglesState.left ? '2px solid #22c55e' : faceScanStage === 'left' ? '2px solid #0284c7' : '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '8px 10px',
                  textAlign: 'center',
                  transition: 'all 0.3s ease'
                }}>
                  <div style={{ fontSize: '11px', fontWeight: '800', color: scannedAnglesState.left ? '#15803d' : faceScanStage === 'left' ? '#0369a1' : '#64748b' }}>
                    👈 Step 2: Left {scannedAnglesState.left ? '✓' : faceScanStage === 'left' ? '●' : '○'}
                  </div>
                  <div style={{ fontSize: '10px', color: scannedAnglesState.left ? '#16a34a' : '#94a3b8', marginTop: '2px', fontWeight: '600' }}>
                    {scannedAnglesState.left ? 'Locked ✓' : faceScanStage === 'left' ? 'Turn Face Left' : 'Pending'}
                  </div>
                </div>

                <div style={{
                  background: scannedAnglesState.right ? '#f0fdf4' : faceScanStage === 'right' ? '#eff6ff' : '#f8fafc',
                  border: scannedAnglesState.right ? '2px solid #22c55e' : faceScanStage === 'right' ? '2px solid #0284c7' : '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '8px 10px',
                  textAlign: 'center',
                  transition: 'all 0.3s ease'
                }}>
                  <div style={{ fontSize: '11px', fontWeight: '800', color: scannedAnglesState.right ? '#15803d' : faceScanStage === 'right' ? '#0369a1' : '#64748b' }}>
                    👉 Step 3: Right {scannedAnglesState.right ? '✓' : faceScanStage === 'right' ? '●' : '○'}
                  </div>
                  <div style={{ fontSize: '10px', color: scannedAnglesState.right ? '#16a34a' : '#94a3b8', marginTop: '2px', fontWeight: '600' }}>
                    {scannedAnglesState.right ? 'Locked ✓' : faceScanStage === 'right' ? 'Turn Face Right' : 'Pending'}
                  </div>
                </div>
              </div>

              {/* Camera Viewport with Oval Target Overlay */}
              <div style={{
                position: 'relative',
                width: '100%',
                height: '270px',
                borderRadius: '18px',
                overflow: 'hidden',
                background: '#0f172a',
                margin: '0 auto 16px auto',
                border: isMultiplePeopleDetected ? '3px solid #ef4444' : faceDetected ? '3px solid #22c55e' : (!studentProfile.profilePic) ? '3px solid #ef4444' : (faceConfidence >= 46) ? '3px solid #22c55e' : '3px solid #38bdf8',
                boxShadow: isMultiplePeopleDetected ? '0 0 30px rgba(239, 68, 68, 0.5)' : faceDetected ? '0 0 30px rgba(34, 197, 94, 0.4)' : (!studentProfile.profilePic) ? '0 0 20px rgba(239, 68, 68, 0.3)' : (faceConfidence >= 46) ? '0 0 25px rgba(34, 197, 94, 0.4)' : '0 0 20px rgba(56, 189, 248, 0.2)'
              }}>
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  muted 
                  style={{ 
                    width: '100%', 
                    height: '100%', 
                    objectFit: 'cover',
                    filter: cameraClarityBoost ? 'contrast(1.12) brightness(1.16) saturate(1.06)' : 'none',
                    transition: 'filter 0.3s ease'
                  }} 
                />
                <canvas ref={canvasRef} style={{ display: 'none' }} />

                {/* Target Oval Face Frame */}
                <div style={{
                  position: 'absolute',
                  top: '50%', left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '180px', height: '220px',
                  borderRadius: '50%',
                  border: isMultiplePeopleDetected 
                    ? '3px solid #ef4444' 
                    : faceDetected || (faceConfidence >= 46) 
                      ? '3px solid #22c55e' 
                      : '3px dashed #38bdf8',
                  boxShadow: isMultiplePeopleDetected 
                    ? '0 0 25px #ef4444' 
                    : faceDetected || (faceConfidence >= 46) 
                      ? '0 0 25px rgba(34, 197, 94, 0.8)' 
                      : '0 0 15px rgba(56, 189, 248, 0.6)',
                  pointerEvents: 'none',
                  transition: 'all 0.3s ease'
                }} />

                {/* Dynamic Angle Guide Banner */}
                <div style={{
                  position: 'absolute',
                  top: '12px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: faceScanStage === 'complete' 
                    ? 'rgba(22, 163, 74, 0.95)' 
                    : faceScanStage === 'center' 
                      ? 'rgba(2, 132, 199, 0.92)' 
                      : faceScanStage === 'left' 
                        ? 'rgba(126, 34, 206, 0.92)' 
                        : 'rgba(217, 119, 6, 0.92)',
                  color: '#ffffff',
                  padding: '5px 14px',
                  borderRadius: '20px',
                  fontSize: '11px',
                  fontWeight: '900',
                  letterSpacing: '0.3px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.35)',
                  zIndex: 4,
                  whiteSpace: 'nowrap'
                }}>
                  {faceScanStage === 'center' && '🎯 STEP 1: LOOK STRAIGHT INTO CAMERA'}
                  {faceScanStage === 'left' && '👈 STEP 2: TURN FACE SLIGHTLY LEFT'}
                  {faceScanStage === 'right' && '👉 STEP 3: TURN FACE SLIGHTLY RIGHT'}
                  {faceScanStage === 'complete' && '✓ ALL 3 ANGLES SCANNED & VERIFIED!'}
                </div>

                {/* Captured Multi-Angle Thumbnails Badge */}
                <div style={{ position: 'absolute', top: '10px', right: '10px', display: 'flex', gap: '4px', zIndex: 4 }}>
                  {scannedAnglesThumbs.center && (
                    <div title="Center angle captured" style={{ width: '28px', height: '28px', borderRadius: '6px', overflow: 'hidden', border: '2px solid #22c55e', background: '#000' }}>
                      <img src={scannedAnglesThumbs.center} alt="C" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  )}
                  {scannedAnglesThumbs.left && (
                    <div title="Left angle captured" style={{ width: '28px', height: '28px', borderRadius: '6px', overflow: 'hidden', border: '2px solid #22c55e', background: '#000' }}>
                      <img src={scannedAnglesThumbs.left} alt="L" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  )}
                  {scannedAnglesThumbs.right && (
                    <div title="Right angle captured" style={{ width: '28px', height: '28px', borderRadius: '6px', overflow: 'hidden', border: '2px solid #22c55e', background: '#000' }}>
                      <img src={scannedAnglesThumbs.right} alt="R" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  )}
                </div>

                {/* Glowing Corner Accents */}
                <div style={{ position: 'absolute', top: '12px', left: '12px', width: '20px', height: '20px', borderTop: '3px solid #38bdf8', borderLeft: '3px solid #38bdf8' }} />
                <div style={{ position: 'absolute', top: '12px', right: '12px', width: '20px', height: '20px', borderTop: '3px solid #38bdf8', borderRight: '3px solid #38bdf8' }} />
                <div style={{ position: 'absolute', bottom: '12px', left: '12px', width: '20px', height: '20px', borderBottom: '3px solid #38bdf8', borderLeft: '3px solid #38bdf8' }} />
                <div style={{ position: 'absolute', bottom: '12px', right: '12px', width: '20px', height: '20px', borderBottom: '3px solid #38bdf8', borderRight: '3px solid #38bdf8' }} />

                {/* Live Status Pill Inside Video */}
                <div style={{
                  position: 'absolute',
                  bottom: '12px', left: '50%',
                  transform: 'translateX(-50%)',
                  background: isMultiplePeopleDetected 
                    ? 'rgba(220, 38, 38, 0.95)' 
                    : faceDetected || (faceConfidence >= 46) 
                      ? 'rgba(22, 163, 74, 0.95)' 
                      : (!studentProfile.profilePic) 
                        ? 'rgba(185, 28, 28, 0.90)' 
                        : (faceConfidence > 0)
                          ? 'rgba(2, 132, 199, 0.92)'
                          : 'rgba(15, 23, 42, 0.85)',
                  color: '#ffffff',
                  padding: '6px 18px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: '800',
                  backdropFilter: 'blur(4px)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  whiteSpace: 'nowrap'
                }}>
                  <span style={{ 
                    width: '8px', height: '8px', borderRadius: '50%', 
                    background: isMultiplePeopleDetected 
                      ? '#fee2e2' 
                      : faceDetected || (faceConfidence >= 46) 
                        ? '#ffffff' 
                        : (!studentProfile.profilePic) 
                          ? '#f87171' 
                          : '#38bdf8' 
                  }}></span>
                  {isMultiplePeopleDetected 
                    ? `🚨 MULTIPLE PEOPLE DETECTED (${detectedPeopleCount} People)` 
                    : faceDetected 
                      ? `✓ Identity Locked: ${student.name}` 
                      : !studentProfile.profilePic
                        ? '🔴 Official Profile Photo Required'
                        : (faceConfidence >= 46) 
                          ? `🟢 Candidate Verified (${faceConfidence}% match)` 
                          : (faceConfidence > 0)
                            ? `Scanning ${student.name}... (${faceConfidence}%)`
                            : '🎯 Align Face in Oval Target'}
                </div>
              </div>

              {/* Verification Progress Bar */}
              <div style={{ marginBottom: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '800', marginBottom: '6px', color: '#475569' }}>
                  <span>Face Scan Status: {faceMatchStatus}</span>
                  <span>{faceDetected ? '100% (Completed)' : `${faceScanProgress}%`}</span>
                </div>
                <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
                  <div style={{ width: `${faceScanProgress}%`, height: '100%', background: isMultiplePeopleDetected ? '#ef4444' : faceDetected ? '#16a34a' : 'linear-gradient(90deg, #0284c7, #38bdf8)', transition: 'width 0.25s ease' }} />
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  disabled={
                    isMultiplePeopleDetected || 
                    (!studentProfile.profilePic && !localStorage.getItem('student_profile_pic') && !localStorage.getItem('last_active_student_profile_pic'))
                  }
                  onClick={handleManualPassFaceAuth}
                  style={{
                    flex: 1,
                    background: (!studentProfile.profilePic && !localStorage.getItem('student_profile_pic') && !localStorage.getItem('last_active_student_profile_pic'))
                      ? '#dc2626'
                      : isMultiplePeopleDetected
                        ? '#dc2626'
                        : (faceDetected || faceConfidence >= 46) 
                          ? '#16a34a' 
                          : '#0284c7',
                    color: '#ffffff',
                    border: 'none',
                    padding: '14px 20px',
                    borderRadius: '12px',
                    fontWeight: '800',
                    fontSize: '14px',
                    cursor: (isMultiplePeopleDetected || (!studentProfile.profilePic && !localStorage.getItem('student_profile_pic') && !localStorage.getItem('last_active_student_profile_pic'))) ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 14px rgba(2, 132, 199, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  {(!studentProfile.profilePic && !localStorage.getItem('student_profile_pic') && !localStorage.getItem('last_active_student_profile_pic'))
                    ? '⛔ No Profile Photo (Exam Blocked)'
                    : isMultiplePeopleDetected
                      ? '⚠️ Multiple People Detected (Blocked)'
                      : (faceDetected || faceScanStage === 'complete')
                        ? '✓ Multi-Angle Verified: Enter Exam Now'
                        : faceScanStage === 'center'
                          ? '📸 1. Lock Center Face & Next (Turn Left 👈)'
                          : faceScanStage === 'left'
                            ? '📸 2. Lock Left Face & Next (Turn Right 👉)'
                            : '📸 3. Lock Right Face & Complete Verification'}
                </button>
                <button
                  type="button"
                  onClick={handleCancelFaceAuth}
                  style={{
                    background: '#f1f5f9',
                    color: '#475569',
                    border: '1px solid #cbd5e1',
                    padding: '14px 20px',
                    borderRadius: '12px',
                    fontWeight: '800',
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      


      {/* FACE MISMATCH PROCTORING ALERT MODAL (Alert 1 of 2 or Final Alert 2 of 2) */}
      {faceMismatchActiveAlert && (
        <div 
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999999,
            background: 'rgba(15, 23, 42, 0.90)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#ffffff',
              borderRadius: '28px',
              border: faceMismatchActiveAlert.strike === 2 ? '4px solid #b91c1c' : '4px solid #dc2626',
              maxWidth: '560px',
              width: '100%',
              padding: '32px 36px',
              textAlign: 'center',
              boxShadow: faceMismatchActiveAlert.strike === 2 
                ? '0 0 50px rgba(185, 28, 28, 0.8), 0 25px 60px rgba(0, 0, 0, 0.6)' 
                : '0 0 40px rgba(220, 38, 38, 0.6), 0 25px 60px rgba(0, 0, 0, 0.5)',
              position: 'relative'
            }}
          >
            {/* Warning Icon with Pulsing Halo */}
            <div style={{
              width: '84px',
              height: '84px',
              borderRadius: '50%',
              background: '#fee2e2',
              display: 'grid',
              placeItems: 'center',
              margin: '0 auto 16px auto',
              border: '4px solid #ef4444',
              boxShadow: '0 0 30px rgba(239, 68, 68, 0.6)'
            }}>
              <span style={{ fontSize: '42px' }}>{faceMismatchActiveAlert.strike === 2 ? '🚨' : '⚠️'}</span>
            </div>

            {/* Strike Badge */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: faceMismatchActiveAlert.strike === 2 ? '#b91c1c' : '#fee2e2',
              border: faceMismatchActiveAlert.strike === 2 ? '1px solid #991b1b' : '1px solid #f87171',
              color: faceMismatchActiveAlert.strike === 2 ? '#ffffff' : '#dc2626',
              padding: '6px 18px',
              borderRadius: '20px',
              fontWeight: '900',
              fontSize: '13px',
              marginBottom: '14px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              {faceMismatchActiveAlert.strike === 2 ? '🚨 FINAL WARNING (ALERT 2 OF 2)' : '⚠️ PROCTOR ALERT (ALERT 1 OF 2)'}
            </div>

            <h2 style={{ fontSize: '23px', fontWeight: '900', color: '#991b1b', margin: '0 0 10px 0' }}>
              {faceMismatchActiveAlert.heading || (faceMismatchActiveAlert.strike === 2 ? 'Final Warning: Proctoring Violation!' : 'Proctoring Violation Detected!')}
            </h2>

            <p style={{ fontSize: '15px', color: '#334155', lineHeight: 1.5, margin: '0 0 18px 0', fontWeight: '600' }}>
              {faceMismatchActiveAlert.message || `The person in front of the camera does NOT match registered candidate ${student.name}.`}
            </p>

            {/* Strike Progress Tracker */}
            <div style={{
              display: 'flex',
              gap: '8px',
              justifyContent: 'center',
              marginBottom: '20px'
            }}>
              <div style={{
                flex: 1,
                padding: '10px 12px',
                borderRadius: '12px',
                background: '#fee2e2',
                border: '2px solid #ef4444',
                color: '#991b1b',
                fontWeight: '800',
                fontSize: '12px'
              }}>
                ⚠️ Alert 1/2: Triggered
              </div>
              <div style={{
                flex: 1,
                padding: '10px 12px',
                borderRadius: '12px',
                background: faceMismatchActiveAlert.strike === 2 ? '#fee2e2' : '#f8fafc',
                border: faceMismatchActiveAlert.strike === 2 ? '2px solid #ef4444' : '1px solid #cbd5e1',
                color: faceMismatchActiveAlert.strike === 2 ? '#991b1b' : '#94a3b8',
                fontWeight: '800',
                fontSize: '12px'
              }}>
                {faceMismatchActiveAlert.strike === 2 ? '🚨 Alert 2/2: ACTIVE' : 'Alert 2/2: Final Warning'}
              </div>
              <div style={{
                flex: 1,
                padding: '10px 12px',
                borderRadius: '12px',
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                color: '#64748b',
                fontWeight: '800',
                fontSize: '12px'
              }}>
                ⛔ Next: Auto-Exit
              </div>
            </div>

            <div style={{ background: '#fff5f5', border: '2px dashed #f87171', borderRadius: '16px', padding: '16px', marginBottom: '22px', textAlign: 'left' }}>
              <b style={{ color: '#991b1b', fontSize: '13px', display: 'block', marginBottom: '6px' }}>
                {faceMismatchActiveAlert.strike === 2 
                  ? '⛔ EXAM TERMINATION NOTICE:' 
                  : '🔒 Proctoring Enforcement:'}
              </b>
              <p style={{ margin: 0, color: '#7f1d1d', fontSize: '13px', lineHeight: 1.5 }}>
                {faceMismatchActiveAlert.submessage || (faceMismatchActiveAlert.strike === 2
                  ? `If the proctoring violation continues, your exam will immediately terminate, your score will be disqualified, and you will be returned to the dashboard!`
                  : `Only registered student ${student.name} is permitted to write this exam alone. Voice assistant and answer inputs remain locked until candidate ${student.name} returns to the camera.`)}
              </p>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => {
                  const alertType = faceMismatchActiveAlert.type;
                  setFaceMismatchActiveAlert(null);
                  if (alertType === 'camera_off') {
                    restartProctorWebcam();
                    speakText("Checking camera status. Please ensure your webcam is turned on and candidate " + student.name + " is visible.");
                  } else {
                    speakText("Checking camera view. Ensure registered candidate " + student.name + " is alone and facing the camera.");
                  }
                }}
                style={{
                  background: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  padding: '14px 28px',
                  borderRadius: '14px',
                  fontWeight: '800',
                  fontSize: '14px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(220, 38, 38, 0.4)'
                }}
              >
                {faceMismatchActiveAlert.type === 'camera_off'
                  ? '📷 Turn On Camera & Continue'
                  : faceMismatchActiveAlert.type === 'face_absent'
                    ? '👁️ Look at Camera & Continue'
                    : faceMismatchActiveAlert.type === 'multiple_people'
                      ? '👥 Ensure You Are Alone & Continue'
                      : `👤 Position Candidate ${student.name} & Continue`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EXAM TERMINATED MODAL (After 2 Warnings Exceeded) */}
      {examTerminationModal && (
        <div 
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999999,
            background: 'rgba(15, 23, 42, 0.95)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#ffffff',
              borderRadius: '28px',
              border: '4px solid #b91c1c',
              maxWidth: '560px',
              width: '100%',
              padding: '36px 40px',
              textAlign: 'center',
              boxShadow: '0 0 60px rgba(185, 28, 28, 0.8), 0 30px 70px rgba(0, 0, 0, 0.7)',
              position: 'relative'
            }}
          >
            <div style={{
              width: '90px',
              height: '90px',
              borderRadius: '50%',
              background: '#fee2e2',
              display: 'grid',
              placeItems: 'center',
              margin: '0 auto 18px auto',
              border: '4px solid #dc2626',
              boxShadow: '0 0 35px rgba(220, 38, 38, 0.6)'
            }}>
              <span style={{ fontSize: '46px' }}>⛔</span>
            </div>

            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: '#fee2e2',
              border: '1px solid #f87171',
              color: '#b91c1c',
              padding: '6px 18px',
              borderRadius: '20px',
              fontWeight: '900',
              fontSize: '13px',
              marginBottom: '14px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              ⛔ EXAM TERMINATED • MALPRACTICE DETECTED
            </div>

            <h2 style={{ fontSize: '25px', fontWeight: '900', color: '#991b1b', margin: '0 0 12px 0' }}>
              Exam Terminated by AI Proctor
            </h2>

            <p style={{ fontSize: '15px', color: '#334155', lineHeight: 1.5, margin: '0 0 20px 0', fontWeight: '600' }}>
              {examTerminationModal.details || `Your examination for <strong>${examTerminationModal.examTitle}</strong> was terminated because of repeated proctoring violations.`}
            </p>

            <div style={{ background: '#fef2f2', border: '2px solid #fca5a5', borderRadius: '16px', padding: '18px', marginBottom: '24px', textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <span style={{ fontSize: '18px' }}>⚠️</span>
                <b style={{ color: '#991b1b', fontSize: '14px' }}>Violation Summary:</b>
              </div>
              <ul style={{ margin: 0, paddingLeft: '20px', color: '#7f1d1d', fontSize: '13px', lineHeight: 1.6 }}>
                <li><strong>Alert 1 of 2:</strong> {examTerminationModal.alert1Reason || 'First warning issued for proctoring violation.'}</li>
                <li><strong>Alert 2 of 2:</strong> {examTerminationModal.alert2Reason || 'Second / final warning issued for proctoring violation.'}</li>
                <li><strong>Violation 3 (Action):</strong> Limit of 2 alerts exceeded. Automatic exam termination and exit executed.</li>
                <li>Teacher and invigilator dashboards have been notified of this proctoring event.</li>
              </ul>
            </div>

            <button
              type="button"
              onClick={() => {
                setExamTerminationModal(null);
                speakText("Returning to main dashboard. Please contact your invigilator if you believe this was an error.");
              }}
              style={{
                background: '#b91c1c',
                color: '#ffffff',
                border: 'none',
                padding: '14px 32px',
                borderRadius: '14px',
                fontWeight: '800',
                fontSize: '15px',
                cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(185, 28, 28, 0.4)'
              }}
            >
              I Acknowledge & Return to Dashboard
            </button>
          </div>
        </div>
      )}

      {/* PROMINENT VOICE ASSISTANT LISTENING OVERLAY */}
      {isVoiceListening && (
        <div 
          onClick={(e) => { 
            e.preventDefault();
            e.stopPropagation(); 
            closeVoiceAssistant(true);
          }}
          style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            background: 'rgba(2, 132, 199, 0.65)', zIndex: 99999,
            display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
            backdropFilter: 'blur(8px)', padding: '20px'
          }}
        >
          <div 
            onClick={(e) => { e.stopPropagation(); }}
            style={{
              background: '#ffffff', width: '90%', maxWidth: '640px', padding: '36px 40px', borderRadius: '28px',
              border: '4px solid #0284c7', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
              boxSizing: 'border-box'
            }}
          >
            <div 
              className="orb-3d" 
              onClick={() => {
                cancelSpeech();
                triggerVoiceCommand();
              }}
              style={{ display: 'grid', placeItems: 'center', margin: '0 auto 16px auto', boxShadow: '0 0 30px rgba(2, 132, 199, 0.5)', cursor: 'pointer' }}
              title="Tap to repeat voice instructions or speak"
            >
              <Mic size={42} color="#ffffff" style={{ zIndex: 2 }} />
            </div>

            <h2 style={{ fontSize: '26px', color: '#0369a1', margin: '0 0 10px 0', fontWeight: '900' }}>
              🎙️ Voice Assistant Active & Listening!
            </h2>

            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#dcfce7', border: '1px solid #86efac', padding: '6px 16px', borderRadius: '20px', fontSize: '13px', color: '#166534', fontWeight: '800', marginBottom: '16px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', display: 'inline-block' }}></span>
              Voice Assistant Opened — Speak command or say "CLOSE" to exit
            </div>
            
            {/* Smart Context-Aware Voice Assistant Display (Exam / Viva / Dashboard) */}
            {((currentExam || isExamActive) && !examSubmitted && (activeTab === 'AI Exam Assistant' || activeTab === 'Active Exam' || isExamActive)) ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', margin: '14px 0 20px 0' }}>
                {/* Active Exam Question & Answer Card */}
                <div style={{ background: '#f0fdf4', border: '2px solid #86efac', padding: '16px 20px', borderRadius: '16px', textAlign: 'left' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: '800', color: '#166534', textTransform: 'uppercase', background: '#dcfce7', padding: '3px 10px', borderRadius: '6px' }}>
                      Exam in Progress: Q{currentQIndex + 1} of {currentExam.questions?.length || 0}
                    </span>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: currentAnswerInput ? '#15803d' : '#b45309' }}>
                      {currentAnswerInput ? '✓ Answer Recorded' : '○ Waiting for Answer'}
                    </span>
                  </div>
                  <p style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', margin: '0 0 10px 0', lineHeight: 1.4 }}>
                    <strong>Question:</strong> {currentExam.questions?.[currentQIndex]?.text || currentExam.questions?.[currentQIndex]?.questionText || ''}
                  </p>
                  {currentAnswerInput ? (
                    <div style={{ background: '#ffffff', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '12px 14px', marginBottom: '10px' }}>
                      <div style={{ fontSize: '12px', fontWeight: '800', color: '#15803d', marginBottom: '4px' }}>
                        ✓ You answered:
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', fontStyle: 'italic', lineHeight: 1.4 }}>
                        "{currentAnswerInput}"
                      </div>
                    </div>
                  ) : (
                    <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', padding: '10px 14px', marginBottom: '10px', color: '#92400e', fontSize: '13px', fontWeight: '600' }}>
                      No answer recorded yet. Tap "Answer by Voice" below to speak your answer.
                    </div>
                  )}

                  {/* Voice Assistant Confirmation Prompt */}
                  {(() => {
                    const totalQ = currentExam?.questions?.length || 1;
                    const isLastQ = currentQIndex >= totalQ - 1;
                    const hasAns = Boolean((currentAnswerInputRef.current || currentAnswerInput || '').trim());
                    return (
                      <div style={{ background: hasAns ? '#ecfdf5' : (isLastQ ? '#f0fdf4' : '#e0f2fe'), border: hasAns ? '2px solid #86efac' : (isLastQ ? '2px solid #86efac' : '2px solid #bae6fd'), borderRadius: '12px', padding: '12px 14px', textAlign: 'center' }}>
                        <p style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: '800', color: hasAns ? '#065f46' : (isLastQ ? '#166534' : '#0369a1') }}>
                          {hasAns
                            ? '🗣️ Say your command: repeat answer, or to say answer again, or next question, or repeat question, or submit.'
                            : (isLastQ 
                                ? '🗣️ Say repeat question, or next question, or say your answer, and say submit.' 
                                : '🗣️ Say your answer, or say repeat question, or next question, or say your answer again.')}
                        </p>
                        <div style={{ fontSize: '12px', fontWeight: '700', color: hasAns ? '#15803d' : (isLastQ ? '#15803d' : '#0284c7') }}>
                          {hasAns
                            ? 'Commands: "REPEAT ANSWER" • "SAY ANSWER AGAIN" • "NEXT QUESTION" • "REPEAT QUESTION" • "SUBMIT"'
                            : (isLastQ
                                ? 'Commands: "REPEAT QUESTION" • "NEXT QUESTION" • "ANSWER" • "SUBMIT"'
                                : 'Commands: "ANSWER" • "REPEAT QUESTION" • "NEXT QUESTION" • "REPEAT ANSWER"')}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Live Speech Detected Transcript */}
                {liveVoiceTranscript && (
                  <div style={{ background: '#eff6ff', border: '1px dashed #3b82f6', padding: '10px 16px', borderRadius: '10px', textAlign: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: '800', color: '#1d4ed8', display: 'block', marginBottom: '2px' }}>LIVE SPEECH RECOGNIZED:</span>
                    <span style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>"{liveVoiceTranscript}"</span>
                  </div>
                )}

                {/* Direct Action Buttons: Finish Answering (Say DONE), Repeat Answer & Next Question */}
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button 
                    type="button"
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      closeVoiceAssistant(false); 
                      handleFinishExamAnswerDictation(currentAnswerInputRef.current || currentAnswerInput);
                    }}
                    style={{ background: '#16a34a', color: '#ffffff', border: 'none', padding: '10px 18px', borderRadius: '10px', fontSize: '13px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                    title="Finish dictating your answer (or simply say DONE)"
                  >
                    ✓ Finish (Say "DONE")
                  </button>
                  <button 
                    type="button"
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      closeVoiceAssistant(false); 
                      updateCurrentAnswer('');
                      speakText("Clearing previous answer. Please speak your answer again now.", () => {
                        setTimeout(() => {
                          handleStartExamAnswerDictation();
                        }, 300);
                      });
                    }}
                    style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', padding: '10px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    🔄 Repeat Answer
                  </button>
                  {currentExam && currentQIndex >= (currentExam.questions?.length || 1) - 1 ? (
                    <button 
                      type="button"
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        closeVoiceAssistant(false); 
                        handleSubmitExam(); 
                      }}
                      style={{ background: '#16a34a', color: '#ffffff', border: 'none', padding: '10px 18px', borderRadius: '10px', fontSize: '13px', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 8px rgba(22, 163, 74, 0.4)' }}
                    >
                      🚀 Submit Exam (Say "SUBMIT")
                    </button>
                  ) : (
                    <button 
                      type="button"
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        closeVoiceAssistant(false); 
                        handleSaveAndNext(); 
                      }}
                      style={{ background: '#0284c7', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: '10px', fontSize: '13px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      Next Question ➡️
                    </button>
                  )}
                  <button 
                    type="button"
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      closeVoiceAssistant(false); 
                      handleReadExamQuestionStepByStep(currentQIndex); 
                    }}
                    style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '10px 14px', borderRadius: '10px', fontSize: '13px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    📖 Repeat Question
                  </button>
                  <button 
                    type="button"
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      closeVoiceAssistant(false); 
                      handleStartExamAnswerDictation(); 
                    }}
                    style={{ background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', padding: '10px 14px', borderRadius: '10px', fontSize: '13px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    🎙️ Say Your Answer
                  </button>
                </div>
              </div>
            ) : (activeTab === 'AI Oral Viva Simulator') ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', margin: '14px 0 20px 0' }}>
                {/* Active Oral Viva Q&A Card */}
                <div style={{ background: '#faf5ff', border: '2px solid #d8b4fe', padding: '16px 20px', borderRadius: '16px', textAlign: 'left' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: '800', color: '#6b21a8', textTransform: 'uppercase', background: '#f3e8ff', padding: '3px 10px', borderRadius: '6px' }}>
                      Oral Viva: Q{activeVivaQIdx + 1} of {currentVivaQList.length || 0}
                    </span>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: vivaAnswerInput ? '#15803d' : '#b45309' }}>
                      {vivaAnswerInput ? '✓ Viva Answer Recorded' : '○ Waiting for Answer'}
                    </span>
                  </div>
                  <p style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', margin: '0 0 10px 0', lineHeight: 1.4 }}>
                    <strong>Viva Question:</strong> {currentVivaQ?.text || ''}
                  </p>
                  {vivaAnswerInput ? (
                    <div style={{ background: '#ffffff', border: '1px solid #e9d5ff', borderRadius: '10px', padding: '12px 14px', marginBottom: '10px' }}>
                      <div style={{ fontSize: '12px', fontWeight: '800', color: '#7e22ce', marginBottom: '4px' }}>
                        ✓ You answered:
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', fontStyle: 'italic', lineHeight: 1.4 }}>
                        "{vivaAnswerInput}"
                      </div>
                    </div>
                  ) : (
                    <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', padding: '10px 14px', marginBottom: '10px', color: '#92400e', fontSize: '13px', fontWeight: '600' }}>
                      No viva answer spoken yet. Tap "Answer Viva" to speak.
                    </div>
                  )}

                  {/* Voice Assistant Viva Confirmation Prompt */}
                  {(() => {
                    const activeVivaList = resolveCurrentVivaList();
                    const totalVivaQ = activeVivaList.length || 1;
                    const curVivaQIdx = activeVivaList.length > 0 ? (vivaQIndex % activeVivaList.length) : 0;
                    const hasVivaAns = Boolean((vivaAnswerInput || vivaAnswersRecord[curVivaQIdx] || '').trim());
                    const isLastVivaQ = curVivaQIdx >= totalVivaQ - 1;
                    return (
                      <div style={{ background: hasVivaAns ? '#ecfdf5' : (isLastVivaQ ? '#f0fdf4' : '#f3e8ff'), border: hasVivaAns ? '2px solid #86efac' : (isLastVivaQ ? '2px solid #86efac' : '2px solid #e9d5ff'), borderRadius: '12px', padding: '12px 14px', textAlign: 'center' }}>
                        <p style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: '800', color: hasVivaAns ? '#065f46' : (isLastVivaQ ? '#166534' : '#6b21a8') }}>
                          {hasVivaAns
                            ? '🗣️ Say your command: repeat answer, or to say answer again, or next question, or repeat question, or submit.'
                            : (isLastVivaQ
                                ? '🗣️ Say repeat question, or next question, or say your answer, and say submit.'
                                : '🗣️ Say your answer and say done when the answer finish, or say repeat question, or next question, or say your answer.')}
                        </p>
                        <div style={{ fontSize: '12px', fontWeight: '700', color: hasVivaAns ? '#15803d' : (isLastVivaQ ? '#15803d' : '#7e22ce') }}>
                          {hasVivaAns
                            ? 'Say: "REPEAT ANSWER" • "SAY ANSWER AGAIN" • "NEXT QUESTION" • "REPEAT QUESTION" • "SUBMIT"'
                            : (isLastVivaQ
                                ? 'Say: "REPEAT QUESTION" • "NEXT QUESTION" • "ANSWER" • "SUBMIT"'
                                : 'Say: "ANSWER (Say DONE when finish)" • "REPEAT QUESTION" • "NEXT QUESTION" • "REPEAT ANSWER"')}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Live Speech Detected Transcript */}
                {liveVoiceTranscript && (
                  <div style={{ background: '#eff6ff', border: '1px dashed #3b82f6', padding: '10px 16px', borderRadius: '10px', textAlign: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: '800', color: '#1d4ed8', display: 'block', marginBottom: '2px' }}>LIVE SPEECH RECOGNIZED:</span>
                    <span style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>"{liveVoiceTranscript}"</span>
                  </div>
                )}

                {/* Direct Action Buttons for Viva: Finish Viva Answer (Say DONE), Repeat Answer, Next Question */}
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button 
                    type="button"
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      closeVoiceAssistant(false); 
                      stopVivaDictation(true);
                    }}
                    style={{ background: '#16a34a', color: '#ffffff', border: 'none', padding: '10px 18px', borderRadius: '10px', fontSize: '13px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                    title="Finish viva response (or simply say DONE)"
                  >
                    ✓ Finish (Say "DONE")
                  </button>
                  <button 
                    type="button"
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      closeVoiceAssistant(false); 
                      setVivaAnswerInput('');
                      speakText("Clearing previous answer. Please speak your viva answer again now.", () => {
                        setTimeout(() => {
                          startVivaDictation(false);
                        }, 300);
                      });
                    }}
                    style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', padding: '10px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    🔄 Repeat Viva Answer
                  </button>
                  {(() => {
                    const activeVivaList = resolveCurrentVivaList();
                    const totalVivaQ = activeVivaList.length || 1;
                    const curVivaQIdx = activeVivaList.length > 0 ? (vivaQIndex % activeVivaList.length) : 0;
                    const isLastVivaQ = curVivaQIdx >= totalVivaQ - 1;
                    return isLastVivaQ ? (
                      <button 
                        type="button"
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          closeVoiceAssistant(false); 
                          handleSubmitVivaExam(); 
                        }}
                        style={{ background: '#16a34a', color: '#ffffff', border: 'none', padding: '10px 18px', borderRadius: '10px', fontSize: '13px', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 8px rgba(22, 163, 74, 0.4)' }}
                      >
                        🚀 Submit Viva (Say "SUBMIT")
                      </button>
                    ) : (
                      <button 
                        type="button"
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          closeVoiceAssistant(false); 
                          handleNextVivaQuestion(); 
                        }}
                        style={{ background: '#9333ea', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: '10px', fontSize: '13px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        Next Viva Question ➡️
                      </button>
                    );
                  })()}
                  <button 
                    type="button"
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      closeVoiceAssistant(false); 
                      handleRepeatVivaQuestion(); 
                    }}
                    style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '10px 14px', borderRadius: '10px', fontSize: '13px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    📖 Repeat Viva Question
                  </button>
                  <button 
                    type="button"
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      closeVoiceAssistant(false); 
                      startVivaDictation(false); 
                    }}
                    style={{ background: '#ede9fe', color: '#6b21a8', border: '1px solid #ddd6fe', padding: '10px 14px', borderRadius: '10px', fontSize: '13px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    🎙️ Answer Viva by Voice
                  </button>
                </div>
              </div>
            ) : (activeTab === 'Study Materials' && (activePracticeMat || activeLessonTest)) ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', margin: '14px 0 20px 0' }}>
                {activePracticeMat ? (() => {
                  const questionsList = (activePracticeMat.questions && activePracticeMat.questions.length > 0)
                    ? activePracticeMat.questions
                    : [{
                        text: activePracticeMat.practiceQuestion || `Explain core concepts of ${activePracticeMat.title}`,
                        oneLineAnswer: activePracticeMat.oneLineAnswer || activePracticeMat.practiceAnswer || activePracticeMat.correctAnswer || activePracticeMat.detail
                      }];
                  const safeQIdx = Math.min(practiceQIdx, questionsList.length - 1);
                  const currentQ = questionsList[safeQIdx] || questionsList[0];
                  const isLastPracticeQ = safeQIdx >= questionsList.length - 1;
                  return (
                    <div style={{ background: '#f5f3ff', border: '2px solid #c4b5fd', padding: '16px 20px', borderRadius: '16px', textAlign: 'left' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '12px', fontWeight: '800', color: '#6d28d9', textTransform: 'uppercase', background: '#ede9fe', padding: '3px 10px', borderRadius: '6px' }}>
                          Study Practice: Q{safeQIdx + 1} of {questionsList.length}
                        </span>
                        <span style={{ fontSize: '12px', fontWeight: '700', color: practiceAnswerInput ? '#15803d' : '#b45309' }}>
                          {practiceAnswerInput ? '✓ Answer Recorded' : '○ Waiting for Answer'}
                        </span>
                      </div>
                      <p style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', margin: '0 0 10px 0', lineHeight: 1.4 }}>
                        <strong>Practice Question:</strong> {currentQ.text || currentQ.question || activePracticeMat.practiceQuestion || activePracticeMat.title}
                      </p>
                      {practiceAnswerInput ? (
                        <div style={{ background: '#ffffff', border: '1px solid #ddd6fe', borderRadius: '10px', padding: '12px 14px', marginBottom: '10px' }}>
                          <div style={{ fontSize: '12px', fontWeight: '800', color: '#6d28d9', marginBottom: '4px' }}>
                            ✓ Your Practice Answer:
                          </div>
                          <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', fontStyle: 'italic', lineHeight: 1.4 }}>
                            "{practiceAnswerInput}"
                          </div>
                        </div>
                      ) : (
                        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', padding: '10px 14px', marginBottom: '10px', color: '#92400e', fontSize: '13px', fontWeight: '600' }}>
                          No practice answer spoken yet. Tap "Say Your Answer" to dictate.
                        </div>
                      )}

                      {/* Confirmation Prompt */}
                      {(() => {
                        const hasPracticeAns = Boolean((practiceAnswerInput || practiceAnswersByQ[safeQIdx] || '').trim());
                        return (
                          <div style={{ background: hasPracticeAns ? '#ecfdf5' : (isLastPracticeQ ? '#f0fdf4' : '#faf5ff'), border: hasPracticeAns ? '2px solid #86efac' : (isLastPracticeQ ? '2px solid #86efac' : '2px solid #ddd6fe'), borderRadius: '12px', padding: '12px 14px', textAlign: 'center' }}>
                            <p style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: '800', color: hasPracticeAns ? '#065f46' : (isLastPracticeQ ? '#166534' : '#6b21a8') }}>
                              {hasPracticeAns
                                ? '🗣️ Say your command: repeat answer, or to say answer again, or next question, or repeat question, or submit.'
                                : (isLastPracticeQ
                                    ? '🗣️ Say repeat question, or next question, or say your answer, and say submit.'
                                    : '🗣️ Say your answer, or say repeat question, or next question, or repeat your answer.')}
                            </p>
                            <div style={{ fontSize: '12px', fontWeight: '700', color: hasPracticeAns ? '#15803d' : (isLastPracticeQ ? '#15803d' : '#7e22ce') }}>
                              {hasPracticeAns
                                ? 'Say: "REPEAT ANSWER" • "SAY ANSWER AGAIN" • "NEXT QUESTION" • "REPEAT QUESTION" • "SUBMIT"'
                                : (isLastPracticeQ
                                    ? 'Say: "REPEAT QUESTION" • "NEXT QUESTION" • "ANSWER" • "SUBMIT"'
                                    : 'Say: "ANSWER" • "REPEAT QUESTION" • "NEXT QUESTION" • "REPEAT ANSWER"')}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  );
                })() : (() => {
                  const totalTestQ = activeLessonTest.questions?.length || 1;
                  const isLastTestQ = lessonTestQIndex >= totalTestQ - 1;
                  const currentQ = activeLessonTest.questions[lessonTestQIndex];
                  return (
                    <div style={{ background: '#f0fdf4', border: '2px solid #86efac', padding: '16px 20px', borderRadius: '16px', textAlign: 'left' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '12px', fontWeight: '800', color: '#15803d', textTransform: 'uppercase', background: '#dcfce7', padding: '3px 10px', borderRadius: '6px' }}>
                          Study Test: Q{lessonTestQIndex + 1} of {totalTestQ}
                        </span>
                        <span style={{ fontSize: '12px', fontWeight: '700', color: lessonTestInput ? '#15803d' : '#b45309' }}>
                          {lessonTestInput ? '✓ Answer Recorded' : '○ Waiting for Answer'}
                        </span>
                      </div>
                      <p style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', margin: '0 0 10px 0', lineHeight: 1.4 }}>
                        <strong>Test Question:</strong> {currentQ?.text || ''}
                      </p>
                      {lessonTestInput ? (
                        <div style={{ background: '#ffffff', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '12px 14px', marginBottom: '10px' }}>
                          <div style={{ fontSize: '12px', fontWeight: '800', color: '#15803d', marginBottom: '4px' }}>
                            ✓ Your Test Answer:
                          </div>
                          <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', fontStyle: 'italic', lineHeight: 1.4 }}>
                            "{lessonTestInput}"
                          </div>
                        </div>
                      ) : (
                        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', padding: '10px 14px', marginBottom: '10px', color: '#92400e', fontSize: '13px', fontWeight: '600' }}>
                          No test answer spoken yet. Tap "Say Your Answer" to dictate.
                        </div>
                      )}

                      {/* Confirmation Prompt */}
                      {(() => {
                        const hasTestAns = Boolean((lessonTestInput || lessonTestAnswers[activeLessonTest.questions?.[lessonTestQIndex]?.id] || '').trim());
                        return (
                          <div style={{ background: hasTestAns ? '#ecfdf5' : '#f0fdf4', border: hasTestAns ? '2px solid #86efac' : (isLastTestQ ? '2px solid #86efac' : '2px solid #bbf7d0'), borderRadius: '12px', padding: '12px 14px', textAlign: 'center' }}>
                            <p style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: '800', color: hasTestAns ? '#065f46' : '#166534' }}>
                              {hasTestAns
                                ? '🗣️ Say your command: repeat answer, or to say answer again, or next question, or repeat question, or submit.'
                                : (isLastTestQ
                                    ? '🗣️ Say repeat question, or next question, or say your answer, and say submit.'
                                    : '🗣️ Say your answer, or say repeat question, or next question, or repeat your answer.')}
                            </p>
                            <div style={{ fontSize: '12px', fontWeight: '700', color: '#15803d' }}>
                              {hasTestAns
                                ? 'Say: "REPEAT ANSWER" • "SAY ANSWER AGAIN" • "NEXT QUESTION" • "REPEAT QUESTION" • "SUBMIT"'
                                : (isLastTestQ
                                    ? 'Say: "REPEAT QUESTION" • "NEXT QUESTION" • "ANSWER" • "SUBMIT"'
                                    : 'Say: "ANSWER" • "REPEAT QUESTION" • "NEXT QUESTION" • "REPEAT ANSWER"')}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  );
                })()}

                {/* Live Speech Detected Transcript */}
                {liveVoiceTranscript && (
                  <div style={{ background: '#eff6ff', border: '1px dashed #3b82f6', padding: '10px 16px', borderRadius: '10px', textAlign: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: '800', color: '#1d4ed8', display: 'block', marginBottom: '2px' }}>LIVE SPEECH RECOGNIZED:</span>
                    <span style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>"{liveVoiceTranscript}"</span>
                  </div>
                )}

                {/* Direct Action Buttons for Study Materials Practice & Test */}
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button 
                    type="button"
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      closeVoiceAssistant(false); 
                      if (activePracticeMat) {
                        handleEvaluatePractice(practiceAnswerInput);
                      } else {
                        handleSaveLessonTestNext();
                      }
                    }}
                    style={{ background: '#16a34a', color: '#ffffff', border: 'none', padding: '10px 18px', borderRadius: '10px', fontSize: '13px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    ✓ Finish (Say "DONE")
                  </button>
                  <button 
                    type="button"
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      closeVoiceAssistant(false); 
                      if (activePracticeMat) {
                        setPracticeAnswerInput('');
                        speakText("Clearing previous answer. Please speak your practice answer again now.", () => {
                          setTimeout(() => handleStartVoiceDictationForPractice(), 300);
                        });
                      } else {
                        setLessonTestInput('');
                        speakText("Clearing previous answer. Please speak your test answer again now.", () => {
                          setTimeout(() => handleStartLessonTestDictation(), 300);
                        });
                      }
                    }}
                    style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', padding: '10px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    🔄 Repeat Answer
                  </button>
                  {(() => {
                    const isLastQ = activePracticeMat
                      ? (practiceQIdx >= ((activePracticeMat.questions?.length || 1) - 1))
                      : (lessonTestQIndex >= ((activeLessonTest?.questions?.length || 1) - 1));
                    return isLastQ ? (
                      <button 
                        type="button"
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          closeVoiceAssistant(false); 
                          if (activePracticeMat) {
                            handleSubmitPracticeToTeacher();
                          } else {
                            handleSubmitLessonTest();
                          }
                        }}
                        style={{ background: '#16a34a', color: '#ffffff', border: 'none', padding: '10px 18px', borderRadius: '10px', fontSize: '13px', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 8px rgba(22, 163, 74, 0.4)' }}
                      >
                        🚀 Submit to Teacher (Say "SUBMIT")
                      </button>
                    ) : (
                      <button 
                        type="button"
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          closeVoiceAssistant(false); 
                          if (activePracticeMat) {
                            const qList = (activePracticeMat.questions && activePracticeMat.questions.length > 0) ? activePracticeMat.questions : [activePracticeMat];
                            const nextIdx = (practiceQIdx + 1) % qList.length;
                            setPracticeQIdx(nextIdx);
                            setPracticeAnswerInput(practiceAnswersByQ[nextIdx] || '');
                            handleSpeakQuestionAnswerExplanation(activePracticeMat, nextIdx);
                          } else {
                            handleSaveLessonTestNext();
                          }
                        }}
                        style={{ background: '#9333ea', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: '10px', fontSize: '13px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        Next Question ➡️
                      </button>
                    );
                  })()}
                  <button 
                    type="button"
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      closeVoiceAssistant(false); 
                      if (activePracticeMat) {
                        handleSpeakQuestionAnswerExplanation(activePracticeMat, practiceQIdx);
                      } else {
                        speakText(`Question ${lessonTestQIndex + 1}: ${activeLessonTest.questions[lessonTestQIndex]?.text}`);
                      }
                    }}
                    style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '10px 14px', borderRadius: '10px', fontSize: '13px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    📖 Repeat Question
                  </button>
                  <button 
                    type="button"
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      closeVoiceAssistant(false); 
                      if (activePracticeMat) {
                        handleStartVoiceDictationForPractice();
                      } else {
                        handleStartLessonTestDictation();
                      }
                    }}
                    style={{ background: '#ede9fe', color: '#6b21a8', border: '1px solid #ddd6fe', padding: '10px 14px', borderRadius: '10px', fontSize: '13px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    🎙️ Say Your Answer
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Default Dashboard Live Speech Transcript */}
                <div style={{ background: '#f0f9ff', border: '2px dashed #0284c7', padding: '24px 20px', borderRadius: '20px', margin: '16px 0 24px 0', minHeight: '90px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <p style={{ margin: 0, fontSize: '18px', color: liveVoiceTranscript ? '#0f172a' : '#0369a1', fontWeight: '800', textAlign: 'center', lineHeight: 1.5 }}>
                    {liveVoiceTranscript ? `"${liveVoiceTranscript}"` : '🎙️ Voice Assistant is opened. Speak your command, or say "CLOSE" if you want to close.'}
                  </p>
                </div>

                {/* Quick Action Shortcuts (1-Tap Simulation) */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', marginBottom: '20px' }}>
                  <button 
                    onClick={(e) => { e.stopPropagation(); closeVoiceAssistant(false); executeCommand('start exam'); }}
                    onMouseEnter={() => speakHover("Start Written Exam button. Click to begin your online examination.")}
                    data-speech="Start Written Exam button. Click to begin your online examination."
                    data-narrate="Start Written Exam button. Click to begin your online examination."
                    aria-label="Start Written Exam button"
                    style={{ background: '#0284c7', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '10px', fontSize: '12px', fontWeight: '800', cursor: 'pointer' }}
                  >
                    🚀 Start Written Exam
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); closeVoiceAssistant(false); executeCommand('results'); }}
                    onMouseEnter={() => speakHover("My Results and Performance button. Click to open your exam and viva scores.")}
                    data-speech="My Results and Performance button. Click to open your exam and viva scores."
                    data-narrate="My Results and Performance button. Click to open your exam and viva scores."
                    aria-label="My Results and Performance button"
                    style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '10px', fontSize: '12px', fontWeight: '800', cursor: 'pointer' }}
                  >
                    📊 My Results
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); closeVoiceAssistant(false); executeCommand('viva'); }}
                    onMouseEnter={() => speakHover("Viva Practice button. Click to open AI oral viva simulator.")}
                    data-speech="Viva Practice button. Click to open AI oral viva simulator."
                    data-narrate="Viva Practice button. Click to open AI oral viva simulator."
                    aria-label="Viva Practice button"
                    style={{ background: '#9333ea', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '10px', fontSize: '12px', fontWeight: '800', cursor: 'pointer' }}
                  >
                    🎙️ Viva Practice
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); closeVoiceAssistant(false); executeCommand('emergency'); }}
                    onMouseEnter={() => speakHover("Emergency SOS button. Click to send immediate alert to your teacher or proctor.")}
                    data-speech="Emergency SOS button. Click to send immediate alert to your teacher or proctor."
                    data-narrate="Emergency SOS button. Click to send immediate alert to your teacher or proctor."
                    aria-label="Emergency SOS button"
                    style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '10px', fontSize: '12px', fontWeight: '800', cursor: 'pointer' }}
                  >
                    🚨 Emergency SOS
                  </button>
                </div>
              </>
            )}

            {/* Manual Voice/Typed Input Fallback */}
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (manualVoiceInput.trim()) {
                  const cmd = manualVoiceInput.trim();
                  setManualVoiceInput('');
                  closeVoiceAssistant(false);
                  executeCommand(cmd);
                }
              }}
              style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}
            >
              <input 
                type="text"
                placeholder="Or type command here (e.g. 'start exam')..."
                value={manualVoiceInput}
                onChange={(e) => setManualVoiceInput(e.target.value)}
                style={{ flex: 1, padding: '12px 16px', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '14px', fontWeight: '600' }}
              />
              <button 
                type="submit"
                style={{ background: '#0f172a', color: '#ffffff', border: 'none', padding: '12px 20px', borderRadius: '12px', fontWeight: '800', fontSize: '14px', cursor: 'pointer' }}
              >
                ⚡ Run
              </button>
            </form>

            <button 
              onClick={(e) => { 
                e.preventDefault(); 
                e.stopPropagation(); 
                closeVoiceAssistant(true);
              }}
              style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '10px 24px', borderRadius: '12px', fontWeight: '800', fontSize: '13px', cursor: 'pointer' }}
            >
              ✖ Close Voice Assistant Overlay (or say "CLOSE")
            </button>
          </div>
        </div>
      )}

      {/* STEP-BY-STEP VOICE ASSISTANT PROFILE WIZARD MODAL */}
      {isVoiceProfileWizardOpen && (
        <div 
          onClick={closeVoiceProfileWizard}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.88)',
            backdropFilter: 'blur(10px)',
            zIndex: 999999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
        >
          <div 
            onClick={e => e.stopPropagation()}
            style={{
              background: '#ffffff',
              borderRadius: '28px',
              maxWidth: '680px',
              width: '100%',
              padding: '36px 32px',
              boxShadow: '0 25px 60px rgba(0,0,0,0.45)',
              border: '4px solid #0284c7',
              textAlign: 'center',
              position: 'relative'
            }}
          >
            {/* Top Close Button */}
            <button
              type="button"
              onClick={closeVoiceProfileWizard}
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                background: '#f1f5f9',
                border: 'none',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                display: 'grid',
                placeItems: 'center',
                fontSize: '18px',
                fontWeight: '800',
                color: '#64748b',
                cursor: 'pointer'
              }}
              title="Close Wizard"
            >
              ✕
            </button>

            {/* Header */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#e0f2fe', color: '#0369a1', padding: '6px 18px', borderRadius: '20px', fontWeight: '800', fontSize: '13px', marginBottom: '12px' }}>
              <span>🎙️ Voice Profile Assistant</span>
            </div>
            <h2 style={{ margin: '0 0 8px 0', fontSize: '24px', fontWeight: '900', color: '#0f172a' }}>
              Step-by-Step Voice Profile Setup
            </h2>
            <p style={{ margin: '0 0 24px 0', fontSize: '14px', color: '#64748b', fontWeight: '600' }}>
              Speak your answer clearly into the microphone. The assistant will advance automatically.
            </p>

            {/* Step Progress Pills */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginBottom: '28px' }}>
              {[
                { num: 1, label: 'Full Name', value: wizardFormData.name },
                { num: 2, label: 'Main Subject', value: wizardFormData.subject }
              ].map(st => {
                const isActive = voiceProfileStep === st.num;
                const isPassed = voiceProfileStep > st.num || (st.value && !isActive);
                return (
                  <button
                    key={st.num}
                    type="button"
                    onClick={() => {
                      wizardStepRef.current = st.num;
                      setVoiceProfileStep(st.num);
                      speakWizardStepPrompt(st.num);
                    }}
                    style={{
                      background: isActive ? '#0284c7' : isPassed ? '#f0fdf4' : '#f8fafc',
                      border: isActive ? '3px solid #0284c7' : isPassed ? '2px solid #86efac' : '1px solid #cbd5e1',
                      borderRadius: '16px',
                      padding: '12px 10px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: isActive ? '0 4px 14px rgba(2, 132, 199, 0.35)' : 'none'
                    }}
                  >
                    <div style={{
                      fontSize: '11px',
                      fontWeight: '800',
                      color: isActive ? '#ffffff' : isPassed ? '#16a34a' : '#64748b',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      {isPassed ? `✓ Step ${st.num}` : `Step ${st.num}`}
                    </div>
                    <div style={{
                      fontSize: '13px',
                      fontWeight: '900',
                      color: isActive ? '#ffffff' : '#0f172a',
                      marginTop: '2px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {st.label}
                    </div>
                    {st.value && (
                      <div style={{
                        fontSize: '11px',
                        fontWeight: '700',
                        color: isActive ? '#e0f2fe' : '#0369a1',
                        marginTop: '2px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {st.value}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Central Animated Mic Orb & Active Question Card */}
            <div style={{ background: '#f8fafc', border: '2px solid #e2e8f0', borderRadius: '20px', padding: '24px', marginBottom: '22px' }}>
              <div 
                className={isWizardListening ? "orb-3d" : ""} 
                onClick={() => {
                  if (isWizardListening) {
                    stopWizardListening();
                  } else {
                    startWizardListening(voiceProfileStep);
                  }
                }}
                style={{
                  width: '68px',
                  height: '68px',
                  borderRadius: '50%',
                  background: isWizardListening ? 'linear-gradient(135deg, #0284c7, #38bdf8)' : '#e2e8f0',
                  display: 'grid',
                  placeItems: 'center',
                  margin: '0 auto 14px auto',
                  cursor: 'pointer',
                  boxShadow: isWizardListening ? '0 0 25px rgba(2, 132, 199, 0.6)' : 'none',
                  transition: 'all 0.2s ease'
                }}
                title={isWizardListening ? "Listening... Click to pause" : "Click to start microphone"}
              >
                <Mic size={32} color={isWizardListening ? '#ffffff' : '#64748b'} />
              </div>

              {/* Status Pill */}
              <div style={{ marginBottom: '12px' }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: isWizardListening ? '#dcfce7' : '#f1f5f9',
                  color: isWizardListening ? '#166534' : '#475569',
                  border: isWizardListening ? '1px solid #86efac' : '1px solid #cbd5e1',
                  borderRadius: '20px',
                  padding: '4px 14px',
                  fontSize: '12px',
                  fontWeight: '800'
                }}>
                  <span style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: isWizardListening ? '#22c55e' : '#94a3b8',
                    display: 'inline-block'
                  }}></span>
                  {isWizardListening ? 'Listening now... Speak your answer' : 'Mic ready. Click to speak or say command'}
                </span>
              </div>

              {/* Step Question Heading */}
              <h3 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: '900', color: '#0369a1' }}>
                {voiceProfileStep === 1 && "Step 1 of 2: What is your full name?"}
                {voiceProfileStep === 2 && "Step 2 of 2: What is your focused main subject?"}
              </h3>

              <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#64748b', fontWeight: '600' }}>
                {voiceProfileStep === 1 && 'Example: "Alex Smith", "Nayana N S", "Priya Sharma"'}
                {voiceProfileStep === 2 && 'Choose one: Computer Science, Mathematics, Physics, Chemistry, Biology, Commerce, Social Science, or Engineering'}
              </p>

              {/* Live Transcript / Current Spoken Value Box */}
              <div style={{
                background: '#ffffff',
                border: '2px dashed #0284c7',
                borderRadius: '16px',
                padding: '16px',
                minHeight: '60px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px'
              }}>
                <span style={{
                  fontSize: '17px',
                  fontWeight: '800',
                  color: wizardTranscript ? '#0f172a' : '#94a3b8',
                  fontStyle: wizardTranscript ? 'normal' : 'italic'
                }}>
                  {wizardTranscript ? `"${wizardTranscript}"` : '🎙️ Waiting for your voice...'}
                </span>
              </div>

              {/* Direct Input & Quick Subject Grid */}
              {voiceProfileStep === 1 && (
                <div style={{ maxWidth: '420px', margin: '0 auto' }}>
                  <input 
                    type="text"
                    value={wizardFormData.name}
                    placeholder="Enter or confirm your full name"
                    onChange={(e) => {
                      const val = e.target.value;
                      setWizardFormData(prev => ({ ...prev, name: val }));
                      wizardFormRef.current = { ...wizardFormRef.current, name: val };
                    }}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      borderRadius: '12px',
                      border: '2px solid #0284c7',
                      fontSize: '15px',
                      fontWeight: '800',
                      color: '#0f172a',
                      boxSizing: 'border-box',
                      textAlign: 'center'
                    }}
                  />
                </div>
              )}

              {voiceProfileStep === 2 && (
                <div>
                  <small style={{ fontSize: '11px', fontWeight: '800', color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '10px' }}>
                    Click or speak any Main Subject:
                  </small>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                    {MAIN_SUBJECTS.map(sub => {
                      const isSelected = wizardFormData.subject === sub;
                      return (
                        <button
                          key={sub}
                          type="button"
                          onClick={() => {
                            setWizardFormData(prev => ({ ...prev, subject: sub }));
                            wizardFormRef.current = { ...wizardFormRef.current, subject: sub };
                            speakText(`Selected main subject ${sub}.`);
                          }}
                          style={{
                            background: isSelected ? '#0284c7' : '#ffffff',
                            color: isSelected ? '#ffffff' : '#0369a1',
                            border: isSelected ? '2px solid #0284c7' : '1px solid #bae6fd',
                            borderRadius: '12px',
                            padding: '10px 6px',
                            fontSize: '12px',
                            fontWeight: '800',
                            cursor: 'pointer',
                            boxShadow: isSelected ? '0 2px 10px rgba(2, 132, 199, 0.3)' : 'none',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {sub}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Controls */}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => speakWizardStepPrompt(voiceProfileStep)}
                style={{
                  background: '#f1f5f9',
                  color: '#0369a1',
                  border: '1px solid #cbd5e1',
                  padding: '10px 18px',
                  borderRadius: '12px',
                  fontWeight: '800',
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                🔁 Repeat Question
              </button>

              <button
                type="button"
                onClick={() => {
                  if (isWizardListening) {
                    stopWizardListening();
                  } else {
                    startWizardListening(voiceProfileStep);
                  }
                }}
                style={{
                  background: isWizardListening ? '#ef4444' : '#0284c7',
                  color: '#ffffff',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '12px',
                  fontWeight: '800',
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Mic size={15} /> {isWizardListening ? '⏹️ Stop Listening' : '🎙️ Start Speaking'}
              </button>

              {voiceProfileStep > 1 && (
                <button
                  type="button"
                  onClick={handleWizardPrevStep}
                  style={{
                    background: '#f8fafc',
                    color: '#475569',
                    border: '1px solid #cbd5e1',
                    padding: '10px 18px',
                    borderRadius: '12px',
                    fontWeight: '800',
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  ← Back
                </button>
              )}

              {voiceProfileStep < 2 ? (
                <button
                  type="button"
                  onClick={handleWizardNextStep}
                  style={{
                    background: '#0284c7',
                    color: '#ffffff',
                    border: 'none',
                    padding: '10px 22px',
                    borderRadius: '12px',
                    fontWeight: '800',
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  Next Step →
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => saveWizardProfile()}
                  style={{
                    background: '#16a34a',
                    color: '#ffffff',
                    border: 'none',
                    padding: '10px 24px',
                    borderRadius: '12px',
                    fontWeight: '900',
                    fontSize: '13px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(22, 163, 74, 0.3)'
                  }}
                >
                  ✓ Complete & Save Profile
                </button>
              )}

              <button
                type="button"
                onClick={closeVoiceProfileWizard}
                style={{
                  background: 'transparent',
                  color: '#64748b',
                  border: 'none',
                  padding: '10px 14px',
                  fontWeight: '700',
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DEDICATED ELEVENLABS AI VOICE SETTINGS MODAL */}
      <ElevenLabsSettings 
        isOpen={isElevenLabsModalOpen} 
        onClose={() => setIsElevenLabsModalOpen(false)} 
      />

      {/* LEFT SIDEBAR */}
      <aside style={{ width: '270px', background: '#0f172a', color: '#ffffff', display: 'flex', flexDirection: 'column', padding: '20px 16px', flexShrink: 0 }}>
        {/* Brand Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '28px', padding: '0 4px' }}>
          <ProjectLogo size="small" showSubtitle={false} />
          <div>
            <span style={{ fontSize: '10px', color: '#38bdf8', fontWeight: '700', letterSpacing: '0.2px', display: 'block', lineHeight: '1.3' }}>
              Learn • Exams • Future
            </span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
          {[
            { id: 'Dashboard', label: 'Dashboard', desc: 'Dashboard overview tab. View upcoming exams and academic progress.', icon: <Home size={18} /> },
            { id: 'AI Exam Assistant', label: 'AI Exam Assistant', desc: 'AI Exam Assistant tab. Access written exam portal with audio questions and voice answers.', icon: <BotIcon /> },
            { id: 'AI Oral Viva Simulator', label: 'AI Oral Viva Simulator', desc: 'AI Oral Viva Simulator tab. Practice spoken oral viva interviews with teacher evaluation.', icon: <Sparkles size={18} /> },
            { id: 'My Exams', label: 'My Exams', desc: 'My Exams tab. View your scheduled and active written exams.', icon: <FileText size={18} /> },
            { id: 'Results & Performance', label: 'Results & Performance', desc: 'Results and Performance tab. View written exam and viva evaluation reports by your teacher.', icon: <BarChart2 size={18} /> },
            { id: 'Certificates', label: 'Voice Certificates', desc: 'Voice Certificates tab. View and download earned completion certificates.', icon: <Award size={18} /> },
            { id: 'Study Materials', label: 'Study Materials', desc: 'Study Materials tab. Audio lessons and accessible study guides.', icon: <BookOpen size={18} /> },
            { id: 'Voice Assistant', label: 'Voice Assistant', desc: 'Voice Assistant settings and quick dictation guide.', icon: <Mic size={18} /> },
            { id: 'Accessibility Settings', label: 'Accessibility Settings', desc: 'Accessibility Settings tab. Configure voice speed and visual contrast.', icon: <Eye size={18} /> },
            { id: 'Notifications', label: 'Notifications', desc: 'Notifications tab. View teacher updates and announcements.', icon: <Bell size={18} /> },
            { id: 'Profile', label: 'Profile', desc: 'Student Profile tab. View registration details and switch subject interest.', icon: <User size={18} /> }
          ].map(item => (
            <button
              key={item.id}
              onClick={() => { 
                setActiveTab(item.id); 
                if (item.id !== 'Results & Performance') {
                  speakText(`Opening ${item.label}`); 
                }
              }}
              onMouseEnter={() => speakHover(item.desc || `${item.label} tab`)}
              data-speech={item.desc || `${item.label} tab`}
              data-narrate={item.desc || `${item.label} tab`}
              aria-label={item.desc || `${item.label} tab`}
              title={item.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 14px',
                borderRadius: '10px',
                background: activeTab === item.id ? '#0284c7' : 'transparent',
                color: activeTab === item.id ? '#ffffff' : '#94a3b8',
                border: 'none',
                fontWeight: activeTab === item.id ? '700' : '600',
                fontSize: '13px',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease'
              }}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Bottom Sidebar Voice Box */}
        <div 
          onClick={triggerVoiceCommand}
          onMouseEnter={() => speakHover("Voice Navigation. Say Hey Assistant to get started.")}
          style={{
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
            border: '1px solid #334155',
            borderRadius: '14px',
            padding: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            cursor: 'pointer',
            marginTop: 'auto'
          }}
        >
          <div style={{ background: '#0284c7', width: '38px', height: '38px', borderRadius: '50%', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <Mic size={20} color="#ffffff" />
          </div>
          <div>
            <b style={{ fontSize: '13px', color: '#ffffff', display: 'block' }}>Voice Navigation</b>
            <small style={{ fontSize: '11px', color: '#94a3b8' }}>Say "Hey Assistant" to get started</small>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        
        {/* Top Header Bar */}
        <header style={{ height: '70px', background: '#ffffff', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button 
              onClick={handleEmergencyAssistAlert}
              onMouseEnter={() => speakHover("Emergency SOS button. Send immediate alert to your teacher or proctor.")}
              data-speech="Emergency SOS button. Send immediate alert to your teacher or proctor."
              data-narrate="Emergency SOS button. Send immediate alert to your teacher or proctor."
              aria-label="Emergency SOS button. Send immediate alert to your teacher or proctor."
              title="Emergency SOS button. Send immediate alert to your teacher or proctor."
              style={{ background: '#ef4444', color: '#ffffff', border: 'none', padding: '10px 16px', borderRadius: '10px', fontWeight: '800', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 4px 12px rgba(239, 68, 68, 0.25)' }}
            >
              <AlertCircle size={16} /> 🚨 Emergency SOS
            </button>
            <button 
              onClick={triggerVoiceCommand}
              onMouseEnter={() => speakHover("Tap to Speak button. Click and speak a voice command.")}
              style={{ background: '#0284c7', color: '#ffffff', border: 'none', padding: '10px 16px', borderRadius: '10px', fontWeight: '800', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)' }}
            >
              <Mic size={16} /> 🎙️ Tap to Speak
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); handleRepeatSpeech(); }}
              onMouseEnter={() => speakHover("Repeat Speech button. Hear the last instruction or spoken message again.")}
              style={{ background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', padding: '10px 16px', borderRadius: '10px', fontWeight: '800', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Repeat size={16} /> 🔄 Repeat Speech
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); speakDashboardFeatures(); }}
              onMouseEnter={() => speakHover("All Features Guide button. Listen to complete audio guide of all dashboard features.")}
              style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', padding: '10px 16px', borderRadius: '10px', fontWeight: '800', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Volume2 size={16} /> 📢 All Features Guide
            </button>

            {/* Master Voice Assistant Enable / Disable Toggle */}
            <button 
              onClick={(e) => { e.stopPropagation(); toggleVoiceAssistantEnabled(); }}
              onMouseEnter={() => speakHover(isVoiceAssistantEnabled ? "Voice Assistant is currently enabled. Click to disable audio speech." : "Voice Assistant is currently disabled. Click to enable audio speech.")}
              style={{
                background: isVoiceAssistantEnabled ? '#ecfdf5' : '#fef2f2',
                color: isVoiceAssistantEnabled ? '#047857' : '#b91c1c',
                border: isVoiceAssistantEnabled ? '1.5px solid #a7f3d0' : '1.5px solid #fecaca',
                padding: '10px 16px',
                borderRadius: '10px',
                fontWeight: '800',
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: isVoiceAssistantEnabled ? '0 2px 8px rgba(16, 185, 129, 0.15)' : '0 2px 8px rgba(239, 68, 68, 0.15)',
                transition: 'all 0.2s ease'
              }}
              title={isVoiceAssistantEnabled ? 'Voice Assistant is Enabled. Click to Disable.' : 'Voice Assistant is Disabled. Click to Enable.'}
            >
              {isVoiceAssistantEnabled ? (
                <>
                  <Volume2 size={16} color="#059669" />
                  <span>🟢 Voice: Enabled</span>
                </>
              ) : (
                <>
                  <VolumeX size={16} color="#dc2626" />
                  <span>🔴 Voice: Disabled</span>
                </>
              )}
            </button>

            {/* Dedicated ElevenLabs AI Voice Settings Trigger */}
            <button 
              onClick={(e) => { e.stopPropagation(); setIsElevenLabsModalOpen(true); }}
              onMouseEnter={() => speakHover("ElevenLabs AI Voice Assistant button. Open settings to select realistic character voices.")}
              style={{
                background: '#f0f9ff',
                color: '#0284c7',
                border: '1.5px solid #38bdf8',
                padding: '10px 16px',
                borderRadius: '10px',
                fontWeight: '800',
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 8px rgba(2, 132, 199, 0.15)'
              }}
              title="Open ElevenLabs AI Voice Assistant Settings"
            >
              <span>⚡ ElevenLabs Voice</span>
            </button>

            {/* Focused Subject Selector & Indicator - Accessible Custom Dropdown */}
            <div ref={headerSubjectDropdownRef} style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setIsHeaderSubDropdownOpen(prev => !prev)}
                onMouseEnter={() => speakHover(`Academic Subject Selector. Currently focused on ${activeSubject}. Click to switch subject.`)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: '#faf5ff',
                  padding: '8px 14px',
                  borderRadius: '10px',
                  border: '2px solid #c084fc',
                  boxShadow: '0 2px 8px rgba(168, 85, 247, 0.15)',
                  cursor: 'pointer',
                  color: '#581c87',
                  fontWeight: '800',
                  fontSize: '13px'
                }}
                title="Your focused academic subject. Filters your whole dashboard."
              >
                <span style={{ fontSize: '15px' }}>🎓</span>
                <span style={{ fontSize: '12px', color: '#6b21a8' }}>Subject:</span>
                <span>{activeSubject}</span>
                <span style={{ fontSize: '10px', marginLeft: '4px' }}>{isHeaderSubDropdownOpen ? '▲' : '▼'}</span>
              </button>
              {isHeaderSubDropdownOpen && (
                <div 
                  role="listbox"
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: '6px',
                    background: '#ffffff',
                    borderRadius: '12px',
                    border: '2px solid #c084fc',
                    boxShadow: '0 12px 30px rgba(107, 33, 168, 0.25)',
                    minWidth: '200px',
                    zIndex: 1000,
                    padding: '6px',
                    maxHeight: '280px',
                    overflowY: 'auto'
                  }}
                >
                  {MAIN_SUBJECTS.map(sub => {
                    const isSelected = sub === activeSubject;
                    return (
                      <div
                        key={sub}
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => {
                          handleSwitchStudentSubject(sub);
                          setIsHeaderSubDropdownOpen(false);
                        }}
                        onMouseEnter={() => speakHover(`${sub} subject`)}
                        style={{
                          padding: '9px 12px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          background: isSelected ? '#f3e8ff' : 'transparent',
                          color: isSelected ? '#6b21a8' : '#1e293b',
                          fontWeight: isSelected ? '800' : '600',
                          fontSize: '13px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          transition: 'background 0.15s ease'
                        }}
                      >
                        <span>{sub}</span>
                        {isSelected && <span style={{ color: '#9333ea', fontWeight: 'bold' }}>✓</span>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button 
              onClick={() => setActiveTab('Notifications')}
              onMouseEnter={() => speakHover(`Notifications button. ${announcements.filter(a => !a.read).length} unread announcements.`)}
              style={{ position: 'relative', background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '40px', height: '40px', display: 'grid', placeItems: 'center', cursor: 'pointer' }}
              title="Notifications"
            >
              <Bell size={20} color="#475569" />
              {announcements.filter(a => !a.read).length > 0 && (
                <span style={{ position: 'absolute', top: '2px', right: '2px', background: '#ef4444', color: '#fff', fontSize: '10px', fontWeight: 'bold', minWidth: '16px', height: '16px', padding: '0 4px', borderRadius: '50%', display: 'grid', placeItems: 'center' }}>
                  {announcements.filter(a => !a.read).length}
                </span>
              )}
            </button>

            <div 
              onClick={() => setActiveTab('Profile')}
              onMouseEnter={() => speakHover(`Student profile for ${formatSpokenName(student.name || studentProfile.name || 'Student')}. Click to view details.`)}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
            >
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#0284c7', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 'bold', fontSize: '15px', overflow: 'hidden' }}>
                {studentProfile.profilePic ? (
                  <img src={studentProfile.profilePic} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  formatSpokenName(student.name || studentProfile.name || 'Student').split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'S'
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <b style={{ fontSize: '14px', color: '#0f172a' }}>{formatSpokenName(student.name || studentProfile.name || 'Student')}</b>
                <small style={{ fontSize: '11px', color: '#64748b' }}>Student</small>
              </div>
            </div>
          </div>
        </header>

        {/* DUAL-MODE COMMAND BAR: VOICE ASSISTANT & TYPED COMMANDS */}
        <div 
          style={{ 
            background: accessibility.highContrast ? '#000000' : '#f8fafc', 
            borderBottom: accessibility.highContrast ? '2px solid #eab308' : '1px solid #e2e8f0', 
            padding: '12px 32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            flexWrap: 'wrap',
            zIndex: 10
          }}
        >
          {/* Typed Command Form */}
          <form 
            onSubmit={handleExecuteTypedCommand}
            style={{ display: 'flex', flex: '1 1 480px', gap: '10px', alignItems: 'center' }}
          >
            <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
              <span style={{ position: 'absolute', left: '14px', fontSize: '18px', pointerEvents: 'none' }}>⌨️</span>
              <input 
                type="text"
                value={typedCommandInput}
                onChange={(e) => setTypedCommandInput(e.target.value)}
                placeholder="Type any command here (e.g. 'open my exams', 'start viva', 'open certificates', 'read profile', 'switch to science', 'emergency sos')..."
                aria-label="Student typed command bar"
                onMouseEnter={() => speakHover("Type any command here. For example: open my exams, start viva, or switch subject.")}
                style={{
                  width: '100%',
                  padding: '11px 16px 11px 44px',
                  borderRadius: '12px',
                  border: accessibility.highContrast ? '2px solid #facc15' : '1.5px solid #cbd5e1',
                  background: accessibility.highContrast ? '#18181b' : '#ffffff',
                  color: accessibility.highContrast ? '#facc15' : '#0f172a',
                  fontSize: '14px',
                  fontWeight: '600',
                  outline: 'none',
                  boxShadow: '0 2px 5px rgba(0,0,0,0.03)'
                }}
              />
              {typedCommandInput && (
                <button 
                  type="button" 
                  onClick={() => setTypedCommandInput('')}
                  onMouseEnter={() => speakHover("Clear command input text")}
                  style={{ position: 'absolute', right: '12px', background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}
                >
                  ✖
                </button>
              )}
            </div>
            <button 
              type="submit"
              onMouseEnter={() => speakHover("Run typed command button")}
              style={{
                background: '#0284c7',
                color: '#ffffff',
                border: 'none',
                padding: '11px 22px',
                borderRadius: '12px',
                fontWeight: '800',
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 6px rgba(2, 132, 199, 0.3)'
              }}
            >
              <span>⚡ Run Command</span>
            </button>
          </form>

          {/* Quick Voice & Typed Command Action Chips */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <button 
              onClick={() => executeCommand('all features')}
              onMouseEnter={() => speakHover("All Features command chip. Listen to full audio guide.")}
              style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', padding: '7px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
              title="Click or say 'all features' to hear all 11 features"
            >
              📢 All Features
            </button>
            <button 
              onClick={() => executeCommand('my exams')}
              onMouseEnter={() => speakHover("Exams command chip. Open scheduled exams.")}
              style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '7px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
              title="Click or say 'my exams'"
            >
              📝 Exams
            </button>
            <button 
              onClick={() => executeCommand('oral viva')}
              onMouseEnter={() => speakHover("Oral Viva command chip. Open AI oral viva simulator.")}
              style={{ background: '#faf5ff', color: '#7e22ce', border: '1px solid #e9d5ff', padding: '7px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
              title="Click or say 'oral viva'"
            >
              🎙️ Viva
            </button>
            <button 
              onClick={() => executeCommand('certificates')}
              onMouseEnter={() => speakHover("Certificates command chip. View your certificates.")}
              style={{ background: '#fefce8', color: '#854d0e', border: '1px solid #fef08a', padding: '7px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
              title="Click or say 'certificates'"
            >
              🏆 Certificates
            </button>
            <button 
              onClick={() => executeCommand('study materials')}
              onMouseEnter={() => speakHover("Study Materials command chip. Open lessons and notes.")}
              style={{ background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a', padding: '7px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
              title="Click or say 'study materials'"
            >
              📚 Study
            </button>
            <button 
              onClick={() => executeCommand('read profile')}
              onMouseEnter={() => speakHover("Read Profile command chip. Hear your profile information.")}
              style={{ background: '#f8fafc', color: '#334155', border: '1px solid #cbd5e1', padding: '7px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
              title="Click or say 'read profile'"
            >
              👤 Read Profile
            </button>
            <button 
              onClick={() => executeCommand('emergency')}
              onMouseEnter={() => speakHover("Emergency SOS command chip. Send urgent alert to teacher.")}
              data-speech="Emergency SOS command chip. Send urgent alert to teacher."
              data-narrate="Emergency SOS command chip. Send urgent alert to teacher."
              aria-label="Emergency SOS command chip. Send urgent alert to teacher."
              style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', padding: '7px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
              title="Click or say 'emergency' or 'sos'"
            >
              🚨 Emergency SOS
            </button>
          </div>
        </div>

        {/* Content Container */}
        <div style={{ flex: 1, padding: '28px 32px', overflowY: 'auto' }}>
          
          {voiceNotice && (
            <div style={{ background: '#0284c7', color: '#ffffff', padding: '12px 18px', borderRadius: '10px', marginBottom: '20px', fontWeight: '600', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Mic size={18} /> {voiceNotice}
            </div>
          )}

          {/* Teacher Live Voice Broadcast Announcement Banner */}
          {broadcasts.length > 0 && (
            <div style={{ background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', color: '#ffffff', padding: '16px 20px', borderRadius: '16px', marginBottom: '20px', boxShadow: '0 4px 14px rgba(2, 132, 199, 0.25)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255, 255, 255, 0.2)', display: 'grid', placeItems: 'center', fontWeight: 'bold' }}>
                  📢
                </div>
                <div>
                  <b style={{ fontSize: '14px', display: 'block' }}>Teacher Voice Announcement: {broadcasts[0].title}</b>
                  <small style={{ fontSize: '12px', opacity: 0.9 }}>From {broadcasts[0].sender || 'Course Teacher'} ({broadcasts[0].time || 'Just now'}) — "{broadcasts[0].message}"</small>
                </div>
              </div>
              <button 
                onClick={() => speakText(`Teacher Voice Announcement from ${broadcasts[0].sender}: ${broadcasts[0].title}. ${broadcasts[0].message}`)}
                style={{ background: '#ffffff', color: '#0284c7', border: 'none', padding: '8px 16px', borderRadius: '10px', fontWeight: '800', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Volume2 size={16} /> 🔊 Play Announcement
              </button>
            </div>
          )}

          {/* TAB 1: DASHBOARD HOME */}
          {activeTab === 'Dashboard' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '28px' }}>
              
              {/* Main Column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                
                {/* Greeting Banner */}
                <div 
                  onMouseEnter={() => speakHover(`Welcome ${formatSpokenName(student.name || studentProfile.name || 'Student')}. Your accessibility is our priority.`)}
                  style={{ display: 'flex', alignItems: 'center', gap: '16px', background: '#ffffff', padding: '20px 24px', borderRadius: '16px', border: '1px solid #e0f2fe', boxShadow: '0 2px 8px rgba(2, 132, 199, 0.05)', cursor: 'default' }}
                >
                  <Sun size={36} color="#f59e0b" />
                  <div>
                    <h1 style={{ margin: 0, fontSize: '24px', color: '#0369a1', fontWeight: '800' }}>
                      {(() => { const h = new Date().getHours(); return h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening'; })()}, {formatSpokenName(student.name || studentProfile.name || 'Student')}!
                    </h1>
                    <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b', fontWeight: '600' }}>
                      Your accessibility. Our priority.
                    </p>
                  </div>
                </div>

                {/* Subject Focus Banner - Accessible Custom Dropdown with Live Hover-to-Speech */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(135deg, #0369a1 0%, #0284c7 100%)', color: '#ffffff', padding: '16px 22px', borderRadius: '16px', boxShadow: '0 4px 14px rgba(2, 132, 199, 0.2)', flexWrap: 'wrap', gap: '14px' }}>
                  <div 
                    onMouseEnter={() => speakHover(`Focused Subject: ${activeSubject}. Dashboard is customized strictly for ${activeSubject}.`)}
                    style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'default' }}
                  >
                    <span style={{ fontSize: '26px' }}>🎓</span>
                    <div>
                      <b style={{ fontSize: '16px', display: 'block' }}>Focused Subject: {activeSubject}</b>
                      <span style={{ fontSize: '13px', color: '#e0f2fe' }}>
                        Dashboard is customized strictly for {activeSubject}. Showing only {activeSubject} modules, exams, and vivas.
                      </span>
                    </div>
                  </div>
                  <div ref={bannerSubjectDropdownRef} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: '800', color: '#e0f2fe' }}>Switch Subject:</span>
                    <button
                      type="button"
                      onClick={() => setIsBannerSubDropdownOpen(prev => !prev)}
                      onMouseEnter={() => speakHover(`Switch Subject dropdown. Currently focused on ${activeSubject}. Click to view all subjects.`)}
                      style={{
                        background: '#ffffff',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '8px 16px',
                        fontSize: '13px',
                        fontWeight: '800',
                        color: '#0369a1',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
                      }}
                      title="Switch your subject interest anytime. Your whole dashboard adapts immediately."
                    >
                      <span>{activeSubject}</span>
                      <span style={{ fontSize: '10px' }}>{isBannerSubDropdownOpen ? '▲' : '▼'}</span>
                    </button>
                    {isBannerSubDropdownOpen && (
                      <div
                        role="listbox"
                        style={{
                          position: 'absolute',
                          top: '100%',
                          right: 0,
                          marginTop: '6px',
                          background: '#ffffff',
                          borderRadius: '12px',
                          border: '2px solid #0284c7',
                          boxShadow: '0 12px 30px rgba(2, 132, 199, 0.28)',
                          minWidth: '220px',
                          zIndex: 1000,
                          padding: '6px',
                          maxHeight: '280px',
                          overflowY: 'auto'
                        }}
                      >
                        {MAIN_SUBJECTS.map(sub => {
                          const isSelected = sub === activeSubject;
                          return (
                            <div
                              key={sub}
                              role="option"
                              aria-selected={isSelected}
                              onClick={() => {
                                handleSwitchStudentSubject(sub);
                                setIsBannerSubDropdownOpen(false);
                              }}
                              onMouseEnter={() => speakHover(`${sub} subject`)}
                              style={{
                                padding: '10px 14px',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                background: isSelected ? '#e0f2fe' : 'transparent',
                                color: isSelected ? '#0369a1' : '#1e293b',
                                fontWeight: isSelected ? '800' : '600',
                                fontSize: '13px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                transition: 'background 0.15s ease'
                              }}
                            >
                              <span>{sub}</span>
                              {isSelected && <span style={{ color: '#0284c7', fontWeight: 'bold' }}>✓</span>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Stat Cards (5 Cards) */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '14px' }}>
                  <StatCard icon={<Calendar size={22} color="#0284c7" />} bg="#f0f9ff" border="#bae6fd" label="Upcoming Exams" value={filteredExams.length.toString()} action="View Schedule →" onClick={() => setActiveTab('My Exams')} speechText={`Upcoming Written Exams: ${filteredExams.length}. Click to view schedule.`} />
                  <StatCard icon={<FileText size={22} color="#16a34a" />} bg="#f0fdf4" border="#bbf7d0" label="Active Written Exams" value={filteredExams.filter(e => isExamActiveNow(e)).length.toString()} action="Start Exam →" onClick={() => { const activeEx = filteredExams.find(e => isExamActiveNow(e)); if (activeEx) startExamHandler(activeEx); else speakText("No active exams right now. Please check back when your teacher assigns an assessment."); }} speechText={`Active Written Exams: ${filteredExams.filter(e => isExamActiveNow(e)).length}. Click to start your written exam.`} />
                  <StatCard icon={<Sparkles size={22} color="#0284c7" />} bg="#f0fdf4" border="#86efac" label="Oral Vivas" value={filteredOralVivas.length.toString()} action="Start Viva →" onClick={() => { setActiveTab('AI Oral Viva Simulator'); speakText(`Opening Oral Viva Simulator. You have ${filteredOralVivas.length} active oral vivas.`); }} speechText={`Oral Vivas: ${filteredOralVivas.length}. Click to start your oral viva.`} />
                  <StatCard icon={<BarChart2 size={22} color="#9333ea" />} bg="#faf5ff" border="#e9d5ff" label="Completed Exams" value={filteredResults.length.toString()} action="View Results →" onClick={() => setActiveTab('Results & Performance')} speechText={`Completed Written Exams: ${filteredResults.length}. Click to view results and teacher evaluations.`} />
                  <StatCard icon={<Award size={22} color="#ea580c" />} bg="#fff7ed" border="#ffedd5" label="Overall Progress" value={filteredResults.length > 0 ? `${overallProgress}%` : 'N/A'} action="View Details →" onClick={() => setActiveTab('Results & Performance')} progress={filteredResults.length > 0 ? overallProgress : 0} speechText={`Overall Progress: ${filteredResults.length > 0 ? `${overallProgress}%` : 'N/A'}. Click to view results and performance.`} />
                </div>

                {/* AI Exam Assistant Center Card */}
                <div style={{ background: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)', border: '1px solid #ddd6fe', borderRadius: '20px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#8b5cf6', display: 'grid', placeItems: 'center' }}>
                      <BotIcon size={24} color="#ffffff" />
                    </div>
                    <div>
                      <h2 style={{ margin: 0, fontSize: '18px', color: '#5b21b6', fontWeight: '800' }}>AI Exam Assistant ({activeSubject})</h2>
                      <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#6d28d9' }}>
                        Get your <strong>{activeSubject}</strong> exam read aloud, answer using your voice, and complete with ease.
                      </p>
                    </div>
                  </div>

                  <div style={{ background: '#ffffff', border: '1px solid #ddd6fe', borderRadius: '14px', padding: '20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: '#ede9fe', display: 'grid', placeItems: 'center' }}>
                      <Mic size={22} color="#7c3aed" />
                    </div>
                    <div>
                      <b style={{ fontSize: '16px', color: '#4c1d95', display: 'block' }}>"Start my {activeSubject} exam"</b>
                      <span style={{ fontSize: '12px', color: '#6d28d9' }}>Speak clearly to start your exam</span>
                    </div>
                    <button 
                      onClick={() => { const target = filteredExams.find(e => isExamActiveNow(e)) || filteredExams[0]; if (target) startExamHandler(target); else speakText("No exams scheduled."); }}
                      onMouseEnter={() => speakHover(`Start Written Exam button for ${activeSubject}. Click to begin your online written examination.`)}
                      data-speech={`Start Written Exam button for ${activeSubject}. Click to begin your online written examination.`}
                      data-narrate={`Start Written Exam button for ${activeSubject}. Click to begin your online written examination.`}
                      aria-label={`Start Written Exam button for ${activeSubject}`}
                      title={`Start Written Exam for ${activeSubject}`}
                      style={{ background: '#7c3aed', color: '#ffffff', border: 'none', padding: '12px 28px', borderRadius: '10px', fontWeight: '800', fontSize: '14px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)' }}
                    >
                      ▶ &nbsp; Start {activeSubject} Written Exam
                    </button>
                  </div>

                  {/* 4 Quick Voice Action Badges */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                    <ActionBadge icon="🔊" title="Read Questions" sub="(Text-to-Speech)" onClick={() => speakText("Read questions feature enabled. Open an exam to listen.")} />
                    <ActionBadge icon="🎙️" title="Answer by Voice" sub="(Speech-to-Text)" onClick={triggerVoiceCommand} />
                    <ActionBadge icon="🔄" title="Repeat Question" sub="(Say 'Repeat')" onClick={() => speakText("You can say repeat anytime during an active exam.")} />
                    <ActionBadge icon="📑" title="Next / Previous" sub="(Say 'Next' or 'Previous')" onClick={() => speakText("Voice navigation for question controls active.")} />
                  </div>
                </div>

                {/* AI Oral Viva Simulator Center Card / Box on Dashboard */}
                <div style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)', border: '1.5px solid #86efac', borderRadius: '20px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#16a34a', display: 'grid', placeItems: 'center' }}>
                        <Sparkles size={24} color="#ffffff" />
                      </div>
                      <div>
                        <h2 style={{ margin: 0, fontSize: '18px', color: '#14532d', fontWeight: '800' }}>AI Oral Viva Simulator ({activeSubject})</h2>
                        <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#166534' }}>
                          {filteredOralVivas.length > 0 
                            ? `${filteredOralVivas.length} teacher-published oral viva ready for ${activeSubject}. Answer with your voice and receive manual teacher evaluation.`
                            : `No oral viva scheduled for ${activeSubject} right now. Teacher scheduled vivas will appear here.`}
                        </p>
                      </div>
                    </div>
                    {filteredOralVivas.length > 0 && (
                      <span style={{ background: '#16a34a', color: '#ffffff', padding: '6px 14px', borderRadius: '10px', fontSize: '12px', fontWeight: '800' }}>
                        ● Active Viva Available
                      </span>
                    )}
                  </div>

                  {filteredOralVivas.length > 0 && (
                    <div style={{ background: '#ffffff', border: '1px solid #bbf7d0', borderRadius: '14px', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
                      <div>
                        <span style={{ fontSize: '11px', background: '#dcfce7', color: '#15803d', padding: '3px 8px', borderRadius: '6px', fontWeight: '800', textTransform: 'uppercase' }}>
                          {filteredOralVivas[0].subject || activeSubject} Oral Viva
                        </span>
                        <h3 style={{ margin: '6px 0 2px 0', fontSize: '16px', color: '#0f172a', fontWeight: '800' }}>
                          {filteredOralVivas[0].title || `${activeSubject} Oral Assessment`}
                        </h3>
                        <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                          {filteredOralVivas[0].questions?.length || 1} Question(s) • Spoken response with Teacher evaluation
                        </p>
                      </div>
                      <button 
                        type="button"
                        onClick={() => {
                          setActiveTab('AI Oral Viva Simulator');
                          speakText(`Opening ${filteredOralVivas[0].title || 'Oral Viva'}. Starting viva questions.`);
                        }}
                        style={{ background: '#16a34a', color: '#ffffff', border: 'none', padding: '12px 24px', borderRadius: '10px', fontWeight: '800', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(22, 163, 74, 0.25)' }}
                      >
                        🎙️ Launch Oral Viva →
                      </button>
                    </div>
                  )}

                  {/* Viva Quick Badges */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                    <ActionBadge icon="🔊" title="Read Viva Q" sub="(Voice Assistant)" onClick={() => { setActiveTab('AI Oral Viva Simulator'); speakText("Tap Repeat Question anytime to hear question."); }} />
                    <ActionBadge icon="🎙️" title="Answer by Voice" sub="(Say 'DONE')" onClick={() => { setActiveTab('AI Oral Viva Simulator'); startVivaDictation(); }} />
                    <ActionBadge icon="🔄" title="Repeat / Next Q" sub="(Voice Nav)" onClick={() => { setActiveTab('AI Oral Viva Simulator'); speakText("Say Next Question or Repeat to navigate viva."); }} />
                    <ActionBadge icon="💾" title="Submit to Teacher" sub="(Teacher Evaluation)" onClick={() => { setActiveTab('AI Oral Viva Simulator'); speakText("Your viva submission will be reviewed and scored by your teacher."); }} />
                  </div>
                </div>

                {/* Upcoming Exams Table */}
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h2 style={{ margin: 0, fontSize: '16px', color: '#0f172a', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Calendar size={18} color="#0284c7" /> Upcoming {activeSubject} Exams
                    </h2>
                    <button onClick={() => setActiveTab('My Exams')} style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>
                      View All →
                    </button>
                  </div>

                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
                        <th style={{ padding: '12px 8px' }}>Exam Title</th>
                        <th style={{ padding: '12px 8px' }}>Subject</th>
                        <th style={{ padding: '12px 8px' }}>Date</th>
                        <th style={{ padding: '12px 8px' }}>Time</th>
                        <th style={{ padding: '12px 8px' }}>Duration</th>
                        <th style={{ padding: '12px 8px', textAlign: 'right' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredExams.length > 0 ? (
                        filteredExams.map(ex => (
                          <tr 
                            key={ex.id} 
                            onMouseEnter={() => speakHover(`Exam: ${ex.title || 'Theory Assessment'}, Subject: ${ex.subject}, Date: ${formatDateForVoice(ex.date)}, Duration: ${ex.duration}`)}
                            style={{ borderBottom: '1px solid #f1f5f9' }}
                          >
                            <td style={{ padding: '14px 8px', fontWeight: '700', color: '#0f172a' }}>
                              <div style={{ fontWeight: '800', color: '#0f172a', fontSize: '14px' }}>{ex.title || 'Theory Assessment'}</div>
                              {(ex.targetStudentEmail || ex.targetStudentName || (student.name && ex.title?.toLowerCase().includes(student.name.toLowerCase()))) && (
                                <span style={{ display: 'inline-block', background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '800', marginTop: '4px' }}>
                                  🎯 Assigned for You ({ex.subject})
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '14px 8px', color: '#475569', fontWeight: '600' }}>{ex.subject}</td>
                            <td style={{ padding: '14px 8px', color: '#475569' }}>{formatDateForVoice(ex.date)}</td>
                            <td style={{ padding: '14px 8px', color: '#475569' }}>{ex.time}</td>
                            <td style={{ padding: '14px 8px', color: '#475569' }}>{ex.duration}</td>
                            <td style={{ padding: '14px 8px', textAlign: 'right' }}>
                              <button 
                                onClick={() => startExamHandler(ex)}
                                onMouseEnter={() => speakHover(isExamActiveNow(ex) ? `Start Exam button for ${ex.title || 'Theory Assessment'}` : `View Details button for ${ex.title || 'Theory Assessment'}`)}
                                style={{ background: '#0284c7', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '8px', fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}
                              >
                                {isExamActiveNow(ex) ? 'Start Exam' : 'View Details'}
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td 
                            colSpan={6} 
                            onMouseEnter={() => speakHover(`No upcoming ${activeSubject} exams scheduled.`)}
                            style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}
                          >
                            No upcoming {activeSubject} exams scheduled.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

              </div>

              {/* Right Column Widgets */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                
                {/* Important Announcements */}
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px' }}>
                  <h2 
                    onMouseEnter={() => speakHover("Important Announcements section")}
                    style={{ margin: '0 0 14px 0', fontSize: '15px', color: '#0f172a', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'default' }}
                  >
                    📢 Important Announcements
                  </h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {announcements.length > 0 ? (
                      announcements.map(ann => (
                        <div 
                          key={ann.id} 
                          onMouseEnter={() => speakHover(`Announcement: ${ann.title}. ${ann.detail || ''}. ${ann.date || ''}`)}
                          style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '10px', cursor: 'pointer' }}
                        >
                          <b style={{ fontSize: '13px', color: '#0369a1', display: 'block' }}>• {ann.title}</b>
                          {ann.detail && <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: '#475569', lineHeight: '1.4' }}>{ann.detail}</p>}
                          <small style={{ fontSize: '11px', color: '#94a3b8' }}>{ann.date}</small>
                        </div>
                      ))
                    ) : (
                      <p 
                        onMouseEnter={() => speakHover("No announcements at this time.")}
                        style={{ margin: 0, fontSize: '13px', color: '#64748b' }}
                      >
                        No announcements at this time.
                      </p>
                    )}
                  </div>
                  <button 
                    onClick={() => setActiveTab('Notifications')} 
                    onMouseEnter={() => speakHover("View all announcements in notifications center")}
                    style={{ width: '100%', marginTop: '12px', background: 'none', border: 'none', color: '#0284c7', fontSize: '12px', fontWeight: '700', cursor: 'pointer', textAlign: 'center' }}
                  >
                    View All →
                  </button>
                </div>

                {/* Quick Access */}
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px' }}>
                  <h2 
                    onMouseEnter={() => speakHover("Quick Access section")}
                    style={{ margin: '0 0 14px 0', fontSize: '15px', color: '#0f172a', fontWeight: '800' }}
                  >
                    ⚡ Quick Access
                  </h2>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <button 
                      onClick={() => setActiveTab('My Exams')} 
                      onMouseEnter={() => speakHover("My Exams shortcut button. View and take your scheduled exams.")}
                      style={{ background: '#f0f9ff', border: '1px solid #bae6fd', padding: '14px', borderRadius: '12px', color: '#0369a1', fontWeight: '700', fontSize: '12px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}
                    >
                      <FileText size={20} color="#0284c7" /> My Exams
                    </button>
                    <button 
                      onClick={() => setActiveTab('Study Materials')} 
                      onMouseEnter={() => speakHover("Study Materials shortcut button. Access voice lessons, notes, and guides.")}
                      style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '14px', borderRadius: '12px', color: '#166534', fontWeight: '700', fontSize: '12px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}
                    >
                      <BookOpen size={20} color="#16a34a" /> Study Materials
                    </button>
                    <button 
                      onClick={() => setActiveTab('Voice Assistant')} 
                      onMouseEnter={() => speakHover("Voice Assistant shortcut button. Practice hands-free commands and viva voice.")}
                      style={{ background: '#faf5ff', border: '1px solid #e9d5ff', padding: '14px', borderRadius: '12px', color: '#6b21a8', fontWeight: '700', fontSize: '12px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}
                    >
                      <Mic size={20} color="#9333ea" /> Voice Assistant
                    </button>
                    <button 
                      onClick={() => setActiveTab('Accessibility Settings')} 
                      onMouseEnter={() => speakHover("Accessibility settings button. Configure high contrast, speech rate, and font sizes.")}
                      style={{ background: '#fff7ed', border: '1px solid #ffedd5', padding: '14px', borderRadius: '12px', color: '#9a3412', fontWeight: '700', fontSize: '12px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}
                    >
                      <Eye size={20} color="#ea580c" /> Accessibility
                    </button>
                  </div>
                </div>

                {/* Recent Activity */}
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px' }}>
                  <h2 
                    onMouseEnter={() => speakHover("Recent Activity section")}
                    style={{ margin: '0 0 14px 0', fontSize: '15px', color: '#0f172a', fontWeight: '800' }}
                  >
                    🕒 Recent Activity
                  </h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '12px', color: '#475569' }}>
                    <div 
                      onMouseEnter={() => speakHover("Completed English Exam, September 26, 2025, score 85 percent")}
                      style={{ cursor: 'pointer' }}
                    >
                      <b style={{ color: '#0f172a', display: 'block' }}>⭕ Completed: English Exam</b>
                      <small style={{ color: '#94a3b8' }}>Sep 26, 2025 • 85%</small>
                    </div>
                    <div 
                      onMouseEnter={() => speakHover("Viewed Physics Study Material, September 24, 2025")}
                      style={{ cursor: 'pointer' }}
                    >
                      <b style={{ color: '#0f172a', display: 'block' }}>📄 Viewed: Physics Study Material</b>
                      <small style={{ color: '#94a3b8' }}>Sep 24, 2025</small>
                    </div>
                    <div 
                      onMouseEnter={() => speakHover("Logged in to your account, September 22, 2025")}
                      style={{ cursor: 'pointer' }}
                    >
                      <b style={{ color: '#0f172a', display: 'block' }}>👤 Logged in to your account</b>
                      <small style={{ color: '#94a3b8' }}>Sep 22, 2025</small>
                    </div>
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* TAB 2: 🤖 AI EXAM ASSISTANT */}
          {activeTab === 'AI Exam Assistant' && (
            <div style={{
              background: (isCameraOff || isOtherPersonDetected || !isScannedStudentWriting) ? '#fffdfd' : '#ffffff',
              border: (isCameraOff || isOtherPersonDetected || !isScannedStudentWriting) ? '3px solid #dc2626' : '1px solid #e2e8f0',
              borderRadius: '20px',
              padding: '32px',
              boxShadow: (isCameraOff || isOtherPersonDetected || !isScannedStudentWriting) ? '0 0 30px rgba(220, 38, 38, 0.35)' : '0 4px 20px rgba(2, 132, 199, 0.06)',
              transition: 'all 0.3s ease'
            }}>
              {currentExam ? (
                <div>
                  {/* RED ALERT BANNER: Displayed in RED when camera is off, face is missing, or others are present */}
                  {(isCameraOff || isOtherPersonDetected || !isScannedStudentWriting || !isFacePresentInExam || isMultiplePeopleDetected) && (
                    <div style={{
                      background: '#fee2e2',
                      border: '3px solid #dc2626',
                      borderRadius: '16px',
                      padding: '16px 20px',
                      marginBottom: '20px',
                      boxShadow: '0 0 25px rgba(220, 38, 38, 0.45)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '16px',
                      flexWrap: 'wrap'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div style={{
                          width: '46px',
                          height: '46px',
                          borderRadius: '50%',
                          background: '#dc2626',
                          color: '#ffffff',
                          display: 'grid',
                          placeItems: 'center',
                          fontSize: '24px',
                          flexShrink: 0
                        }}>
                          🚨
                        </div>
                        <div>
                          <b style={{ fontSize: '16px', color: '#991b1b', display: 'block' }}>
                            {isCameraOff
                              ? (faceMismatchStrikeCount > 0
                                  ? `PROCTOR ALERT (WARNING ${faceMismatchStrikeCount}/2): EXAM CAMERA TURNED OFF!`
                                  : 'PROCTOR ALERT: EXAM CAMERA TURNED OFF / NO VIDEO FEED!')
                              : !isFacePresentInExam
                                ? (faceMismatchStrikeCount > 0 
                                    ? `PROCTOR ALERT (WARNING ${faceMismatchStrikeCount}/2): SCANNED FACE NOT DETECTED!` 
                                    : 'PROCTOR ALERT: SCANNED FACE NOT DETECTED IN CAMERA!')
                                : isMultiplePeopleDetected
                                  ? (faceMismatchStrikeCount > 0
                                      ? `PROCTOR ALERT (WARNING ${faceMismatchStrikeCount}/2): MULTIPLE PEOPLE DETECTED ${detectedPeopleCount > 1 ? `(${detectedPeopleCount} People)` : ''}!`
                                      : `PROCTOR ALERT: MULTIPLE PEOPLE DETECTED ${detectedPeopleCount > 1 ? `(${detectedPeopleCount} People in View)` : ''}!`)
                                  : (faceMismatchStrikeCount > 0 
                                      ? `SECURITY ALERT (WARNING ${faceMismatchStrikeCount}/2): UNRECOGNIZED PERSON DETECTED!` 
                                      : 'SECURITY ALERT: UNRECOGNIZED PERSON DETECTED (OTHERS WRITING)!')}
                          </b>
                          <p style={{ margin: '3px 0 0 0', fontSize: '13px', color: '#b91c1c' }}>
                            {isCameraOff
                              ? `Your webcam is turned off, disabled, or blocked. Examination rules strictly require candidate ${student.name} to keep the webcam ON and remain clearly visible at all times. ${faceMismatchStrikeCount >= 2 ? 'FINAL WARNING: One more violation will terminate and exit your exam!' : `Proctor warning ${faceMismatchStrikeCount || 1} of 2 issued. On the 3rd violation, the exam will automatically exit!`}`
                              : !isFacePresentInExam
                                ? `Your face is not detected in front of the exam camera. Please look directly into the camera. ${faceMismatchStrikeCount >= 2 ? 'FINAL WARNING: One more violation will terminate and exit your exam!' : `Proctor warning ${faceMismatchStrikeCount || 1} of 2 issued. On the 3rd violation, the exam will automatically exit!`}`
                                : isMultiplePeopleDetected
                                  ? `Multiple people ${detectedPeopleCount > 1 ? `(${detectedPeopleCount} people)` : ''} detected in front of the camera. Only candidate ${student.name} is permitted to write this exam. ${faceMismatchStrikeCount >= 2 ? 'FINAL WARNING: One more violation will terminate and exit your exam!' : `Proctor warning ${faceMismatchStrikeCount || 1} of 2 issued. On the 3rd violation, the exam will automatically exit!`}`
                                  : `The person in front of the camera does NOT match scanned student ${student.name}. ${faceMismatchStrikeCount >= 2 ? 'FINAL WARNING: One more violation will terminate your exam!' : `Proctor warning ${faceMismatchStrikeCount || 1} of 2 issued. On the 3rd violation, the exam will automatically exit!`}`}
                          </p>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{
                          background: '#dc2626',
                          color: '#ffffff',
                          padding: '8px 16px',
                          borderRadius: '10px',
                          fontWeight: '900',
                          fontSize: '12px',
                          letterSpacing: '0.5px',
                          textTransform: 'uppercase'
                        }}>
                          {faceMismatchStrikeCount > 0 
                            ? (faceMismatchStrikeCount >= 2 ? '🚨 FINAL ALERT (2 OF 2)' : `⚠️ ALERT ${faceMismatchStrikeCount} OF 2`) 
                            : '🔴 PROCTOR ALERT'}
                        </span>
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
                    <div>
                      <h1 style={{ margin: 0, fontSize: '22px', color: '#0369a1', fontWeight: '800' }}>{currentExam.title}</h1>
                      <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                        Question {currentQIndex + 1} of {currentExam.questions.length} • {currentExam.questions[currentQIndex]?.marks || 2} Marks
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <div style={{
                        background: (isCameraOff || isOtherPersonDetected || !isScannedStudentWriting || !isFacePresentInExam || isMultiplePeopleDetected) ? '#fee2e2' : '#f0fdf4',
                        border: (isCameraOff || isOtherPersonDetected || !isScannedStudentWriting || !isFacePresentInExam || isMultiplePeopleDetected) ? '1px solid #f87171' : '1px solid #86efac',
                        padding: '8px 14px',
                        borderRadius: '10px',
                        fontWeight: '800',
                        color: (isCameraOff || isOtherPersonDetected || !isScannedStudentWriting || !isFacePresentInExam || isMultiplePeopleDetected) ? '#dc2626' : '#166534',
                        fontSize: '13px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        <span style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: (isCameraOff || isOtherPersonDetected || !isScannedStudentWriting || !isFacePresentInExam || isMultiplePeopleDetected) ? '#dc2626' : '#22c55e',
                          display: 'inline-block'
                        }}></span>
                        {(isCameraOff || isOtherPersonDetected || !isScannedStudentWriting || !isFacePresentInExam || isMultiplePeopleDetected) 
                          ? (isCameraOff
                              ? (faceMismatchStrikeCount > 0 ? `🔴 CAMERA OFF (Alert ${faceMismatchStrikeCount}/2)` : '🔴 CAMERA OFF')
                              : !isFacePresentInExam 
                                ? (faceMismatchStrikeCount > 0 ? `🔴 FACE MISSING (Alert ${faceMismatchStrikeCount}/2)` : '🔴 FACE MISSING') 
                                : isMultiplePeopleDetected 
                                  ? (faceMismatchStrikeCount > 0 ? `🚨 MULTIPLE PEOPLE (Alert ${faceMismatchStrikeCount}/2)` : '🚨 MULTIPLE PEOPLE') 
                                  : (faceMismatchStrikeCount > 0 ? `🔴 WRONG PERSON (Alert ${faceMismatchStrikeCount}/2)` : '🔴 UNAUTHORIZED PERSON')) 
                          : '🛡️ Scanned Student Verified'}
                      </div>
                      <div style={{ background: '#f0f9ff', padding: '8px 16px', borderRadius: '10px', border: '1px solid #bae6fd', fontWeight: 'bold', color: '#0284c7' }}>
                        ⏱ Time Remaining: {Math.floor(examTimeRemaining / 60)}m {examTimeRemaining % 60}s
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleExitExamWithoutSubmitting(e);
                        }}
                        style={{
                          background: '#fff1f2',
                          color: '#e11d48',
                          border: '1px solid #fecdd3',
                          padding: '8px 14px',
                          borderRadius: '10px',
                          fontWeight: '800',
                          fontSize: '13px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                        title="Safely exit exam without submitting"
                      >
                        🚪 Exit Exam
                      </button>
                    </div>
                  </div>

                  {examSubmitted ? (
                    <div style={{ textAlign: 'center', padding: '40px' }}>
                      <CheckCircle size={64} color="#22c55e" style={{ marginBottom: '16px' }} />
                      <h2 style={{ fontSize: '24px', color: '#0f172a' }}>Exam Submitted Successfully!</h2>
                      <p style={{ color: '#64748b' }}>Your answers have been recorded. Results will be published soon.</p>
                      <button onClick={() => setActiveTab('Dashboard')} style={{ background: '#0284c7', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', marginTop: '16px' }}>
                        Return to Dashboard
                      </button>
                    </div>
                  ) : (
                    <div>
                      {/* Continuous AI Facial Proctoring Card with High-Visibility Live Webcam Feed */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '16px',
                        background: (isCameraOff || isOtherPersonDetected || !isScannedStudentWriting || !isFacePresentInExam || isMultiplePeopleDetected)
                          ? 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)'
                          : 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                        border: (isCameraOff || isOtherPersonDetected || !isScannedStudentWriting || !isFacePresentInExam || isMultiplePeopleDetected)
                          ? '2px solid #ef4444'
                          : '2px solid #86efac',
                        borderRadius: '16px',
                        padding: '14px 18px',
                        marginBottom: '20px',
                        boxShadow: (isCameraOff || isOtherPersonDetected || !isScannedStudentWriting || !isFacePresentInExam || isMultiplePeopleDetected)
                          ? '0 0 20px rgba(239, 68, 68, 0.4)'
                          : '0 4px 14px rgba(34, 197, 94, 0.12)',
                        transition: 'all 0.3s ease'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                          {/* Live Webcam Stream Box (High-Visibility for Proctoring & Face Recognition) */}
                          <div style={{
                            width: '140px',
                            height: '105px',
                            borderRadius: '12px',
                            overflow: 'hidden',
                            background: '#0f172a',
                            position: 'relative',
                            border: (isCameraOff || isMultiplePeopleDetected || isOtherPersonDetected || !isScannedStudentWriting || !isFacePresentInExam) ? '3px solid #dc2626' : '3px solid #22c55e',
                            boxShadow: (isCameraOff || isMultiplePeopleDetected || isOtherPersonDetected || !isScannedStudentWriting || !isFacePresentInExam) ? '0 0 18px rgba(239, 68, 68, 0.85)' : '0 0 10px rgba(34, 197, 94, 0.4)',
                            flexShrink: 0
                          }}>
                            {/* Webcam Label Header */}
                            <div style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              right: 0,
                              zIndex: 15,
                              background: 'rgba(15, 23, 42, 0.90)',
                              color: '#f8fafc',
                              fontSize: '8px',
                              fontWeight: '900',
                              padding: '2px 6px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              letterSpacing: '0.4px',
                              textTransform: 'uppercase'
                            }}>
                              <span>📷 EXAM WEBCAM</span>
                              <span style={{ 
                                color: (isCameraOff || isMultiplePeopleDetected || isOtherPersonDetected || !isScannedStudentWriting || !isFacePresentInExam) ? '#ef4444' : '#22c55e',
                                fontWeight: '900'
                              }}>
                                {isCameraOff 
                                  ? '✕ CAMERA OFF' 
                                  : !isFacePresentInExam 
                                    ? '✕ NO PERSON' 
                                    : isMultiplePeopleDetected 
                                      ? '✕ MULTIPLE' 
                                      : (isOtherPersonDetected || !isScannedStudentWriting) 
                                        ? '✕ MISMATCH' 
                                        : '● LIVE'}
                              </span>
                            </div>

                            <video
                              ref={proctorVideoRef}
                              autoPlay
                              playsInline
                              muted
                              style={{ 
                                width: '100%', 
                                height: '100%', 
                                objectFit: 'cover',
                                filter: cameraClarityBoost ? 'contrast(1.12) brightness(1.16) saturate(1.06)' : 'none'
                              }}
                            />
                            <canvas ref={proctorCanvasRef} style={{ display: 'none' }} />

                            {/* Prominent Overlay Inside Webcam when No Person Detected */}
                            {(!isFacePresentInExam && !isCameraOff) && (
                              <div style={{
                                position: 'absolute',
                                inset: 0,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: 'rgba(220, 38, 38, 0.55)',
                                backdropFilter: 'blur(2px)',
                                zIndex: 12,
                                textAlign: 'center',
                                padding: '4px',
                                pointerEvents: 'none'
                              }}>
                                <span style={{ fontSize: '20px', lineHeight: 1 }}>⚠️</span>
                                <b style={{
                                  color: '#ffffff',
                                  fontSize: '9px',
                                  fontWeight: '900',
                                  letterSpacing: '0.4px',
                                  background: '#b91c1c',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  marginTop: '3px',
                                  boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
                                  textTransform: 'uppercase'
                                }}>
                                  NO PERSON DETECTED
                                </b>
                                <span style={{ color: '#fef2f2', fontSize: '8px', fontWeight: '800', marginTop: '2px', textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>
                                  Face camera now!
                                </span>
                              </div>
                            )}

                            {/* Prominent Overlay Inside Webcam when Camera is Off */}
                            {isCameraOff && (
                              <div style={{
                                position: 'absolute',
                                inset: 0,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: 'rgba(15, 23, 42, 0.90)',
                                zIndex: 12,
                                textAlign: 'center',
                                padding: '4px',
                                pointerEvents: 'none'
                              }}>
                                <span style={{ fontSize: '20px', lineHeight: 1 }}>🚫</span>
                                <b style={{
                                  color: '#ffffff',
                                  fontSize: '9px',
                                  fontWeight: '900',
                                  letterSpacing: '0.4px',
                                  background: '#dc2626',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  marginTop: '3px',
                                  boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
                                  textTransform: 'uppercase'
                                }}>
                                  CAMERA OFF
                                </b>
                                <span style={{ color: '#fca5a5', fontSize: '8px', fontWeight: '800', marginTop: '2px' }}>
                                  Webcam disconnected
                                </span>
                              </div>
                            )}

                            {/* Live Face Bounding Box Overlay Drawn Over Camera Feed */}
                            <div style={{
                              position: 'absolute',
                              inset: '16px 6px 6px 6px',
                              border: (isCameraOff || isMultiplePeopleDetected || isOtherPersonDetected || !isScannedStudentWriting || !isFacePresentInExam)
                                ? '2px dashed #ef4444'
                                : '2px dashed #22c55e',
                              background: (isCameraOff || isMultiplePeopleDetected || isOtherPersonDetected || !isScannedStudentWriting || !isFacePresentInExam)
                                ? 'rgba(239, 68, 68, 0.22)'
                                : 'rgba(34, 197, 94, 0.10)',
                              borderRadius: '6px',
                              pointerEvents: 'none',
                              boxShadow: (isCameraOff || isMultiplePeopleDetected || isOtherPersonDetected || !isScannedStudentWriting || !isFacePresentInExam)
                                ? 'inset 0 0 10px rgba(239, 68, 68, 0.6)'
                                : 'inset 0 0 6px rgba(34, 197, 94, 0.3)',
                              transition: 'all 0.3s ease',
                              zIndex: 11
                            }}>
                              <span style={{
                                position: 'absolute',
                                bottom: '2px',
                                left: '2px',
                                fontSize: '8px',
                                fontWeight: '900',
                                background: (isCameraOff || isMultiplePeopleDetected || isOtherPersonDetected || !isScannedStudentWriting || !isFacePresentInExam) ? '#dc2626' : '#16a34a',
                                color: '#ffffff',
                                padding: '1px 5px',
                                borderRadius: '3px',
                                letterSpacing: '0.3px',
                                lineHeight: '1.1'
                              }}>
                                {isCameraOff
                                  ? '🔴 CAMERA OFF'
                                  : !isFacePresentInExam 
                                    ? '🔴 NO PERSON' 
                                    : isMultiplePeopleDetected 
                                      ? (detectedPeopleCount > 1 ? `🚨 MULTIPLE (${detectedPeopleCount})` : '🚨 MULTIPLE') 
                                      : (isOtherPersonDetected || !isScannedStudentWriting) 
                                        ? (faceMismatchStrikeCount > 0 ? `🚨 WRONG PERSON (${faceMismatchStrikeCount}/2)` : '🚨 UNAUTHORIZED') 
                                        : '✓ CANDIDATE'}
                              </span>
                            </div>

                            <div style={{
                              position: 'absolute',
                              top: '18px',
                              right: '4px',
                              width: '10px',
                              height: '10px',
                              borderRadius: '50%',
                              zIndex: 16,
                              background: (isCameraOff || isMultiplePeopleDetected || isOtherPersonDetected || !isScannedStudentWriting || !isFacePresentInExam) ? '#ef4444' : '#22c55e',
                              boxShadow: (isCameraOff || isMultiplePeopleDetected || isOtherPersonDetected || !isScannedStudentWriting || !isFacePresentInExam) ? '0 0 8px #ef4444' : '0 0 6px #22c55e'
                            }} />
                          </div>

                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                              <b style={{ fontSize: '13px', color: (isCameraOff || isMultiplePeopleDetected || isOtherPersonDetected || !isScannedStudentWriting || !isFacePresentInExam) ? '#991b1b' : '#166534' }}>
                                {isCameraOff
                                  ? (faceMismatchStrikeCount > 0 ? `🔴 PROCTOR ALERT: CAMERA TURNED OFF (Alert ${faceMismatchStrikeCount}/2)!` : '🔴 PROCTOR ALERT: CAMERA TURNED OFF!')
                                  : !isFacePresentInExam
                                    ? '🔴 PROCTOR ALERT: SCANNED FACE NOT DETECTED IN CAMERA!'
                                    : isMultiplePeopleDetected
                                      ? `🔴 PROCTOR ALERT: MULTIPLE PEOPLE DETECTED ${detectedPeopleCount > 1 ? `(${detectedPeopleCount} People in View)` : ''}!`
                                      : (isOtherPersonDetected || !isScannedStudentWriting)
                                        ? `🔴 WARNING ${faceMismatchStrikeCount > 0 ? `(Alert ${faceMismatchStrikeCount}/2)` : ''}: OTHER FACE DETECTED (NOT ${student.name})!`
                                        : '🟢 Scanned Student Writing: Verified'}
                              </b>
                              {isCameraOff ? (
                                <span style={{ fontSize: '11px', background: '#dc2626', color: '#ffffff', padding: '2px 8px', borderRadius: '10px', fontWeight: '900', letterSpacing: '0.5px' }}>
                                  CAMERA OFF
                                </span>
                              ) : isMultiplePeopleDetected ? (
                                <span style={{ fontSize: '11px', background: '#dc2626', color: '#ffffff', padding: '2px 8px', borderRadius: '10px', fontWeight: '900', letterSpacing: '0.5px' }}>
                                  MALPRACTICE ALERT
                                </span>
                              ) : !isFacePresentInExam ? (
                                <span style={{ fontSize: '11px', background: '#dc2626', color: '#ffffff', padding: '2px 8px', borderRadius: '10px', fontWeight: '900', letterSpacing: '0.5px' }}>
                                  FACE ABSENT
                                </span>
                              ) : (isOtherPersonDetected || !isScannedStudentWriting) ? (
                                <span style={{ fontSize: '11px', background: '#dc2626', color: '#ffffff', padding: '2px 8px', borderRadius: '10px', fontWeight: '900', letterSpacing: '0.5px' }}>
                                  {faceMismatchStrikeCount > 0 ? `ALERT ${faceMismatchStrikeCount}/2` : 'PROCTOR LOCK'}
                                </span>
                              ) : null}
                            </div>
                            <p style={{ margin: '0 0 6px 0', fontSize: '12px', color: (isCameraOff || isMultiplePeopleDetected || isOtherPersonDetected || !isScannedStudentWriting || !isFacePresentInExam) ? '#b91c1c' : '#15803d' }}>
                              Candidate: <strong>{student.name}</strong> • Status: {isCameraOff
                                ? `Exam camera is turned off or blocked! Continuous webcam monitoring is mandatory. (Alerts: ${faceMismatchStrikeCount} of 2, auto-exit on 3).`
                                : !isFacePresentInExam
                                  ? `Candidate face missing from webcam. You must look directly at the camera. (Alerts: ${faceMismatchStrikeCount} of 2, auto-exit on 3).`
                                  : isMultiplePeopleDetected
                                    ? `Multiple people ${detectedPeopleCount > 1 ? `(${detectedPeopleCount} people)` : ''} detected in camera view! Only candidate ${student.name} is permitted. (Alerts: ${faceMismatchStrikeCount} of 2, auto-exit on 3).`
                                    : (isOtherPersonDetected || !isScannedStudentWriting)
                                      ? `Face mismatch: Unrecognized person in camera! Except verified candidate ${student.name}, no other face is permitted. (Alerts: ${faceMismatchStrikeCount} of 2, auto-exit on 3).`
                                      : 'Verified scanned student writing alone. Voice assistant listening.'}
                            </p>

                            {/* 3-Strike Warning Meter: Alerts 2 times, Exits on 3rd time */}
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(255, 255, 255, 0.7)', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '4px 8px' }}>
                              <span style={{ fontSize: '11px', fontWeight: '800', color: '#475569' }}>PROCTOR ENFORCEMENT:</span>
                              <span style={{
                                padding: '2px 8px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: '900',
                                background: faceMismatchStrikeCount >= 1 ? '#dc2626' : '#e2e8f0',
                                color: faceMismatchStrikeCount >= 1 ? '#ffffff' : '#64748b'
                              }}>
                                Alert 1 {faceMismatchStrikeCount >= 1 ? '⚠️' : '○'}
                              </span>
                              <span style={{
                                padding: '2px 8px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: '900',
                                background: faceMismatchStrikeCount >= 2 ? '#dc2626' : '#e2e8f0',
                                color: faceMismatchStrikeCount >= 2 ? '#ffffff' : '#64748b'
                              }}>
                                Alert 2 {faceMismatchStrikeCount >= 2 ? '🚨' : '○'}
                              </span>
                              <span style={{
                                padding: '2px 8px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: '900',
                                background: '#991b1b',
                                color: '#ffffff'
                              }}>
                                Exit on 3 ⛔
                              </span>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            if (isCameraOff) {
                              setFaceMismatchActiveAlert({
                                strike: faceMismatchStrikeCount || 1,
                                maxStrikes: 2,
                                type: 'camera_off',
                                title: `⚠️ PROCTOR ALERT: EXAM CAMERA TURNED OFF`,
                                heading: `Exam Camera Turned Off!`,
                                message: `Your exam webcam is turned off, disabled, or blocked. Continuous video monitoring is compulsory for candidate ${student.name}.`,
                                submessage: `Proctoring warning ${faceMismatchStrikeCount || 1} of 2. After 2 alerts, the exam will automatically exit!`
                              });
                            } else if (!isFacePresentInExam) {
                              setFaceMismatchActiveAlert({
                                strike: faceMismatchStrikeCount || 1,
                                maxStrikes: 2,
                                type: 'face_absent',
                                title: `⚠️ PROCTOR ALERT: SCANNED FACE NOT DETECTED`,
                                heading: `Candidate Face Missing from Camera!`,
                                message: `Your face is not visible to the exam camera. Please look directly into the camera.`,
                                submessage: `Proctoring warning ${faceMismatchStrikeCount || 1} of 2. After 2 alerts, the exam will automatically exit!`
                              });
                            } else if (isMultiplePeopleDetected) {
                              setFaceMismatchActiveAlert({
                                strike: faceMismatchStrikeCount || 1,
                                maxStrikes: 2,
                                type: 'multiple_people',
                                title: `⚠️ PROCTOR ALERT: MULTIPLE PEOPLE DETECTED`,
                                heading: `Multiple People in Camera View!`,
                                message: `Facial recognition proctoring detected ${detectedPeopleCount > 1 ? `${detectedPeopleCount} people` : 'multiple people'} in front of your camera.`,
                                submessage: `Proctoring warning ${faceMismatchStrikeCount || 1} of 2. After 2 alerts, the exam will automatically exit!`
                              });
                            } else if (isOtherPersonDetected || !isScannedStudentWriting) {
                              setFaceMismatchActiveAlert({
                                strike: faceMismatchStrikeCount || 1,
                                maxStrikes: 2,
                                type: 'face_mismatch',
                                title: `⚠️ SECURITY ALERT: UNRECOGNIZED PERSON DETECTED`,
                                heading: `Unrecognized Person Detected!`,
                                message: `The person in front of the camera does NOT match registered student ${student.name}.`,
                                submessage: `Proctoring warning ${faceMismatchStrikeCount || 1} of 2. After 2 alerts, the exam will automatically exit!`
                              });
                            }
                            const proctorStatus = isCameraOff
                              ? `Proctor alert: Your exam camera is turned off or blocked. Please turn on your webcam immediately. Continuous camera monitoring is compulsory! You have had ${faceMismatchStrikeCount} of 2 alerts. On the 3rd time, the exam exits.`
                              : !isFacePresentInExam
                                ? `Proctor alert: Candidate face is not detected in camera. Please face the webcam. You have had ${faceMismatchStrikeCount} of 2 alerts. On the 3rd time, the exam exits.`
                                : isMultiplePeopleDetected
                                  ? `Malpractice Security Alert: Multiple people detected in exam camera ${detectedPeopleCount > 1 ? `(${detectedPeopleCount} people)` : ''}. Only candidate ${student.name} is permitted to write. You have had ${faceMismatchStrikeCount} of 2 alerts. On the 3rd time, the exam exits.`
                                  : (isOtherPersonDetected || !isScannedStudentWriting)
                                    ? `Security Warning: Unrecognized person detected in exam camera. ${faceMismatchStrikeCount > 0 ? `Warning ${faceMismatchStrikeCount} of 2 has been issued.` : ''} The person writing does not match registered candidate ${student.name}. On the 3rd time, the exam exits.`
                                    : `Facial proctoring is verified. Candidate ${student.name} is writing the exam alone in front of the webcam. Voice assistant is active.`;
                            announce(proctorStatus);
                            speakText(proctorStatus);
                          }}
                          style={{
                            background: '#ffffff',
                            color: (isCameraOff || isMultiplePeopleDetected || isOtherPersonDetected || !isScannedStudentWriting || !isFacePresentInExam) ? '#991b1b' : '#166534',
                            border: (isCameraOff || isMultiplePeopleDetected || isOtherPersonDetected || !isScannedStudentWriting || !isFacePresentInExam) ? '1px solid #fca5a5' : '1px solid #86efac',
                            padding: '8px 14px',
                            borderRadius: '8px',
                            fontWeight: '800',
                            fontSize: '12px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          <Volume2 size={14} /> 🔊 Proctor Status
                        </button>
                      </div>

                      {/* Question Palette / Navigation Bar */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '12px', fontWeight: '800', color: '#475569', marginRight: '4px' }}>Question Navigator:</span>
                        {currentExam.questions.map((q, idx) => {
                          const qId = q && q.id !== undefined ? q.id : idx + 1;
                          const hasAnswer = Boolean(
                            (idx === currentQIndex ? currentAnswerInput : (
                              studentAnswers[`${currentExam.id}-${idx}`] ||
                              studentAnswers[`${currentExam._id || currentExam.id}-${idx}`] ||
                              studentAnswers[idx] ||
                              studentAnswers[`q_${idx}`] ||
                              studentAnswers[`${qId}`] ||
                              studentAnswers[`q_${qId}`]
                            ))?.trim()
                          );
                          const isActive = idx === currentQIndex;

                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => handleJumpToQuestion(idx)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '6px 12px',
                                borderRadius: '8px',
                                border: isActive ? '2px solid #0284c7' : hasAnswer ? '1px solid #86efac' : '1px solid #cbd5e1',
                                background: isActive ? '#e0f2fe' : hasAnswer ? '#f0fdf4' : '#ffffff',
                                color: isActive ? '#0369a1' : hasAnswer ? '#166534' : '#64748b',
                                fontWeight: isActive ? '900' : '700',
                                fontSize: '12px',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                              title={`Question ${idx + 1}: ${hasAnswer ? 'Answered' : 'Not answered'}`}
                            >
                              <span>Q{idx + 1}</span>
                              {hasAnswer && <span style={{ color: '#16a34a', fontWeight: '900' }}>✓</span>}
                            </button>
                          );
                        })}
                      </div>

                      {(() => {
                        const currentQ = currentExam.questions[currentQIndex];
                        const activeQPrompt = currentQ?.text || currentQ?.questionText || '';
                        const activeQOpts = currentQ?.options || [];

                        return (
                          <>
                            <div style={{
                              background: (isCameraOff || isOtherPersonDetected || !isScannedStudentWriting) ? '#fff5f5' : '#f8fafc',
                              padding: '24px',
                              borderRadius: '16px',
                              border: (isCameraOff || isOtherPersonDetected || !isScannedStudentWriting) ? '2px solid #ef4444' : '1px solid #e2e8f0',
                              marginBottom: '24px',
                              boxShadow: (isCameraOff || isOtherPersonDetected || !isScannedStudentWriting) ? '0 0 14px rgba(239, 68, 68, 0.2)' : 'none'
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#0284c7', textTransform: 'uppercase', background: '#e0f2fe', padding: '4px 8px', borderRadius: '6px' }}>
                                    {currentExam.questions[currentQIndex]?.type || 'Short Answer'}
                                  </span>
                                </div>
                                <span style={{ fontSize: '12px', fontWeight: '700', color: (isCameraOff || isOtherPersonDetected || !isScannedStudentWriting) ? '#dc2626' : currentAnswerInput ? '#16a34a' : '#94a3b8' }}>
                                  {(isCameraOff || isOtherPersonDetected || !isScannedStudentWriting) 
                                    ? (isCameraOff ? '🔴 Input Locked: Camera Turned Off' : '🔴 Input Locked: Unauthorized Face') 
                                    : currentAnswerInput ? '● Answer Recorded' : '○ Not yet answered'}
                                </span>
                              </div>
                              <h2 style={{ fontSize: '18px', color: '#0f172a', margin: '0 0 16px 0', lineHeight: 1.4 }}>
                                {activeQPrompt}
                              </h2>

                              {activeQOpts && activeQOpts.length > 0 ? (
                                <div style={{ display: 'grid', gap: '10px' }}>
                                  {activeQOpts.map((opt, optIdx) => (
                                    <label key={optIdx} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: currentAnswerInput === opt ? '#f0f9ff' : '#ffffff', padding: '12px 16px', borderRadius: '10px', border: currentAnswerInput === opt ? '2px solid #0284c7' : '1px solid #cbd5e1', cursor: 'pointer' }}>
                                      <input 
                                        type="radio" 
                                        name={`mcq-${currentQIndex}`} 
                                        checked={currentAnswerInput === opt} 
                                        onChange={() => updateCurrentAnswer(opt)} 
                                      />
                                      <span style={{ fontSize: '14px', fontWeight: '600' }}>{opt}</span>
                                    </label>
                                  ))}
                                </div>
                              ) : (
                                <div>
                                  {/* Live Voice Answer Dictation Banner */}
                                  {isDictatingExamAnswer && (
                                    <div style={{
                                      background: '#fef2f2',
                                      border: '2px solid #ef4444',
                                      borderRadius: '12px',
                                      padding: '12px 16px',
                                      marginBottom: '12px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      gap: '12px',
                                      boxShadow: '0 4px 14px rgba(239, 68, 68, 0.2)'
                                    }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', background: '#dc2626', boxShadow: '0 0 10px #ef4444' }} />
                                        <div>
                                          <strong style={{ fontSize: '13px', color: '#991b1b', display: 'block' }}>
                                            🎙️ Listening to your answer...
                                          </strong>
                                          <span style={{ fontSize: '12px', color: '#b91c1c' }}>
                                            {liveExamAnswerTranscript ? `Speech recognized: "${liveExamAnswerTranscript}"` : 'Speak clearly now... Say "DONE" or tap Finish when finished.'}
                                          </span>
                                        </div>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={handleStopExamAnswerDictation}
                                        style={{
                                          background: '#dc2626',
                                          color: '#ffffff',
                                          border: 'none',
                                          padding: '8px 16px',
                                          borderRadius: '8px',
                                          fontWeight: '800',
                                          fontSize: '12px',
                                          cursor: 'pointer',
                                          boxShadow: '0 2px 6px rgba(220, 38, 38, 0.3)'
                                        }}
                                      >
                                        ✓ Finish & Read Answer
                                      </button>
                                    </div>
                                  )}

                                  <textarea
                                    rows={5}
                                    placeholder={(isCameraOff || isOtherPersonDetected || !isScannedStudentWriting) ? (isCameraOff ? `⚠️ Input Locked: Camera is turned off. Turn on webcam to write...` : `⚠️ Input Locked: Return to camera view as candidate ${student.name} to write...`) : `Type answer here or tap "Answer by Voice" to speak...`}
                                    value={currentAnswerInput}
                                    onBlur={handleExamTextareaBlur}
                                    onKeyDown={handleExamTextareaKeyDown}
                                    onChange={e => {
                                      if (isCameraOff || isOtherPersonDetected || !isScannedStudentWriting) {
                                        announce(isCameraOff ? "⚠️ Input locked: Exam camera is turned off." : "⚠️ Input locked: Unrecognized face detected.");
                                        return;
                                      }
                                      updateCurrentAnswer(e.target.value);
                                    }}
                                    style={{
                                      width: '100%',
                                      padding: '14px',
                                      borderRadius: '10px',
                                      border: (isCameraOff || isOtherPersonDetected || !isScannedStudentWriting) ? '2px solid #dc2626' : isDictatingExamAnswer ? '2px solid #ef4444' : '1px solid #cbd5e1',
                                      background: (isCameraOff || isOtherPersonDetected || !isScannedStudentWriting) ? '#fff5f5' : '#ffffff',
                                      color: (isCameraOff || isOtherPersonDetected || !isScannedStudentWriting) ? '#7f1d1d' : '#0f172a',
                                      fontSize: '14px',
                                      boxSizing: 'border-box'
                                    }}
                                  />
                                  {(isCameraOff || isOtherPersonDetected || !isScannedStudentWriting) && (
                                    <div style={{ color: '#b91c1c', fontSize: '12px', fontWeight: '800', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <span>🚨</span>
                                      <span>{isCameraOff ? 'Answer recording locked: Exam camera is turned off. Turn on your webcam to continue.' : `Answer recording locked. Only verified candidate ${student.name} can write or dictate answers.`}</span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Controls */}
                            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                              <button 
                                type="button" 
                                onClick={() => handleReadExamQuestionStepByStep(currentQIndex)} 
                                style={{ background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', padding: '12px 18px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                                title="Read question text and options aloud step by step with voice dictation"
                              >
                                <Volume2 size={16} /> 🔊 Read Question (TTS)
                              </button>

                              {/* Dedicated Read My Answer Button */}
                              <button 
                                type="button" 
                                onClick={handleReadCurrentAnswerAloud}
                                style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #86efac', padding: '12px 18px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                                title="Read aloud the answer you spoke or typed"
                              >
                                <Volume2 size={16} /> 🔊 Read My Answer
                              </button>

                              {/* Voice Answer Button: Dictates directly into answer input */}
                              {(isCameraOff || isOtherPersonDetected || !isScannedStudentWriting) ? (
                                <button 
                                  type="button" 
                                  onClick={() => {
                                    const msg = isCameraOff
                                      ? `Voice assistant locked: Exam camera is turned off. Please turn on your webcam to resume writing.`
                                      : `Voice assistant locked: Unrecognized person detected. Only verified candidate ${student.name} is permitted to speak or dictate answers.`;
                                    announce(isCameraOff ? "🔒 Voice Assistant Locked: Camera Turned Off" : "🔒 Voice Assistant Locked: Unauthorized Person");
                                    speakText(msg);
                                  }} 
                                  style={{
                                    background: '#fee2e2',
                                    color: '#dc2626',
                                    border: '2px solid #ef4444',
                                    padding: '12px 18px',
                                    borderRadius: '10px',
                                    fontWeight: '800',
                                    cursor: 'not-allowed',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    boxShadow: '0 0 12px rgba(239, 68, 68, 0.3)'
                                  }}
                                  title={isCameraOff ? "Voice Assistant locked: Camera is turned off." : "Voice Assistant is locked because an unrecognized face was detected."}
                                >
                                  {isCameraOff ? '🔒 Voice Locked (Camera Off)' : '🔒 Voice Locked (Unauthorized Face)'}
                                </button>
                              ) : isDictatingExamAnswer ? (
                                <button 
                                  type="button" 
                                  onClick={handleStopExamAnswerDictation} 
                                  style={{
                                    background: '#fee2e2',
                                    color: '#dc2626',
                                    border: '2px solid #ef4444',
                                    padding: '12px 18px',
                                    borderRadius: '10px',
                                    fontWeight: '800',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    boxShadow: '0 0 14px rgba(239, 68, 68, 0.4)'
                                  }}
                                  title="Click to stop dictation and hear your recorded answer"
                                >
                                  <Mic size={16} color="#dc2626" /> 🔴 Listening... (Tap to Finish / Say "DONE")
                                </button>
                              ) : (
                                <button 
                                  type="button" 
                                  onClick={handleStartExamAnswerDictation} 
                                  style={{
                                    background: '#e0f2fe',
                                    color: '#0369a1',
                                    border: '1px solid #bae6fd',
                                    padding: '12px 18px',
                                    borderRadius: '10px',
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                  }}
                                  title="Speak your answer"
                                >
                                  <Mic size={16} /> 🎙️ Answer by Voice
                                </button>
                              )}

                              <button type="button" onClick={handlePreviousQ} disabled={currentQIndex === 0} style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '12px 18px', borderRadius: '10px', fontWeight: 'bold', cursor: currentQIndex === 0 ? 'not-allowed' : 'pointer', opacity: currentQIndex === 0 ? 0.6 : 1 }}>
                                ← Previous
                              </button>
                              <button type="button" onClick={handleSaveAndNext} style={{ background: '#0284c7', color: '#ffffff', border: 'none', padding: '12px 24px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>
                                Save & Next →
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleExitExamWithoutSubmitting(e);
                                }}
                                style={{
                                  background: '#fff1f2',
                                  color: '#e11d48',
                                  border: '1px solid #fecdd3',
                                  padding: '12px 20px',
                                  borderRadius: '10px',
                                  fontWeight: 'bold',
                                  cursor: 'pointer',
                                  marginLeft: 'auto',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px'
                                }}
                                title="Exit exam without submitting"
                              >
                                🚪 Exit Exam
                              </button>
                              <button type="button" onClick={handleSubmitExam} style={{ background: '#16a34a', color: '#ffffff', border: 'none', padding: '12px 24px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', marginLeft: '12px' }}>
                                Submit Exam ✓
                              </button>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <BotIcon size={48} color="#0284c7" style={{ marginBottom: '16px' }} />
                  <h2 style={{ fontSize: '20px', color: '#0f172a' }}>AI Exam Assistant Ready</h2>
                  <p style={{ color: '#64748b' }}>Select an active exam below or say "Start my exam" to begin.</p>
                  <button onClick={() => startExamHandler(exams[0])} style={{ background: '#0284c7', color: '#fff', border: 'none', padding: '12px 28px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', marginTop: '16px' }}>
                    ▶ Start Computer Networks Theory Exam
                  </button>
                </div>
              )}
            </div>
          )}

          {/* NEW FEATURE TAB: 🎙️ AI ORAL VIVA & MOCK INTERVIEW SIMULATOR */}
          {activeTab === 'AI Oral Viva Simulator' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', padding: '28px', borderRadius: '20px', color: '#ffffff' }}>
                <span style={{ fontSize: '12px', background: 'rgba(255,255,255,0.2)', padding: '4px 12px', borderRadius: '12px', fontWeight: '800' }}>
                  🎙️ AI Oral Viva & Technical Interview Simulator
                </span>
                <h1 style={{ margin: '12px 0 8px 0', fontSize: '26px', fontWeight: '900' }}>Interactive Viva Practice</h1>
                <p style={{ margin: 0, fontSize: '14px', color: '#e0f2fe', lineHeight: 1.5 }}>
                  Practice technical oral viva exams hands-free. Listen to AI questions, dictate your answers via voice, and get instant score evaluations with audio feedback!
                </p>
              </div>

              {/* Active Subject Vivas Quick Start Panel */}
              {Array.isArray(filteredOralVivas) && filteredOralVivas.length > 0 ? (
                <>
                  <div style={{ background: '#f8fafc', border: '2px solid #38bdf8', borderRadius: '18px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', boxShadow: '0 4px 14px rgba(2, 132, 199, 0.08)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '22px' }}>👨‍🏫</span>
                        <div>
                          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0369a1' }}>Active {activeSubject} Oral Vivas</h3>
                          <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>Click below to instantly launch your {activeSubject} viva exam.</p>
                        </div>
                      </div>
                      <span style={{ fontSize: '11px', background: '#e0f2fe', color: '#0284c7', padding: '4px 12px', borderRadius: '12px', fontWeight: '800' }}>
                        {filteredOralVivas.length} {activeSubject} Viva{filteredOralVivas.length > 1 ? 's' : ''}
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
                      {filteredOralVivas.map(v => {
                        const isSelected = vivaSubject === v.title || vivaSubject === v.subject || vivaSubject === String(v.id);
                        const qCount = v.questions?.length || v.questionsCount || 1;
                        return (
                          <div 
                            key={v.id} 
                            style={{ 
                              background: isSelected ? '#f0f9ff' : '#ffffff', 
                              border: isSelected ? '2px solid #0284c7' : '1px solid #cbd5e1', 
                              borderRadius: '12px', 
                              padding: '14px 16px', 
                              display: 'flex', 
                              justifyContent: 'space-between', 
                              alignItems: 'center',
                              boxShadow: isSelected ? '0 4px 12px rgba(2, 132, 199, 0.15)' : 'none'
                            }}
                          >
                            <div>
                              <b style={{ fontSize: '14px', color: '#0f172a', display: 'block' }}>{v.title}</b>
                              <small style={{ fontSize: '12px', color: '#64748b' }}>{v.subject} • {qCount} Question{qCount > 1 ? 's' : ''}</small>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setVivaSubject(v.title || v.subject);
                                setVivaQIndex(0);
                                setVivaFeedback(null);
                                setVivaAnswerInput('');
                                const firstQText = v.questions?.[0]?.text || `Core concepts of ${v.title}`;
                                const msg = `Starting ${v.title}. Question 1: ${firstQText}`;
                                announce(msg);
                                speakText(msg);
                              }}
                              style={{
                                background: isSelected ? '#16a34a' : '#0284c7',
                                color: '#ffffff',
                                border: 'none',
                                padding: '8px 16px',
                                borderRadius: '8px',
                                fontSize: '12px',
                                fontWeight: '800',
                                cursor: 'pointer'
                              }}
                            >
                              {isSelected ? '✓ Active Viva' : '▶ Start Viva'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* If Viva is Submitted: Show Results & Evaluation Card */}
                  {isVivaSubmitted && vivaOverallResult ? (
                    <div style={{ background: '#ffffff', border: '2px solid #86efac', borderRadius: '20px', padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px', boxShadow: '0 8px 24px rgba(22, 163, 74, 0.12)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '20px' }}>
                        <div>
                          <span style={{ 
                            fontSize: '12px', 
                            background: vivaOverallResult.status === 'Evaluated' ? '#dcfce7' : '#fef3c7', 
                            color: vivaOverallResult.status === 'Evaluated' ? '#15803d' : '#b45309', 
                            border: `1px solid ${vivaOverallResult.status === 'Evaluated' ? '#86efac' : '#fde68a'}`,
                            padding: '4px 12px', 
                            borderRadius: '12px', 
                            fontWeight: '800' 
                          }}>
                            {vivaOverallResult.status === 'Evaluated' ? '✓ Oral Viva Evaluated by Teacher' : '⏳ Submitted — Awaiting Teacher Evaluation'}
                          </span>
                          <h2 style={{ margin: '8px 0 4px 0', fontSize: '24px', color: '#0f172a', fontWeight: '900' }}>
                            {vivaOverallResult.vivaTitle || vivaOverallResult.topic || `${activeSubject} Oral Viva`}
                          </h2>
                          <small style={{ color: '#64748b', fontSize: '13px' }}>
                            Submitted on {vivaOverallResult.date || 'Today'} {vivaOverallResult.time ? `at ${vivaOverallResult.time}` : ''} • {(vivaOverallResult.questions || vivaOverallResult.questionResults || []).length} Question{((vivaOverallResult.questions || vivaOverallResult.questionResults || []).length) > 1 ? 's' : ''} Submitted
                          </small>
                        </div>
                        {vivaOverallResult.status === 'Evaluated' ? (
                          <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{ background: '#f0fdf4', border: '2px solid #22c55e', padding: '12px 20px', borderRadius: '16px', textAlign: 'center' }}>
                              <span style={{ fontSize: '11px', fontWeight: '800', color: '#15803d', textTransform: 'uppercase' }}>Teacher Score</span>
                              <div style={{ fontSize: '28px', fontWeight: '900', color: '#166534' }}>
                                {vivaOverallResult.teacherScore !== undefined && vivaOverallResult.teacherScore !== null ? vivaOverallResult.teacherScore : '—'} <span style={{ fontSize: '16px', fontWeight: '700', color: '#64748b' }}>/ 10</span>
                              </div>
                              <span style={{ fontSize: '12px', fontWeight: '800', color: '#15803d' }}>
                                {vivaOverallResult.gradeStatus || 'Evaluated'}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div style={{ background: '#fffbeb', border: '2px solid #fde68a', padding: '12px 20px', borderRadius: '16px', textAlign: 'center' }}>
                            <span style={{ fontSize: '11px', fontWeight: '800', color: '#b45309', textTransform: 'uppercase' }}>Evaluation Status</span>
                            <div style={{ fontSize: '18px', fontWeight: '900', color: '#92400e', marginTop: '4px' }}>
                              ⏳ Pending Review
                            </div>
                            <span style={{ fontSize: '12px', fontWeight: '700', color: '#b45309' }}>
                              Teacher will evaluate
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Notice Banner */}
                      {vivaOverallResult.status === 'Evaluated' ? (
                        <div style={{ background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: '14px', padding: '16px 20px' }}>
                          <b style={{ color: '#166534', fontSize: '14px', display: 'block', marginBottom: '4px' }}>
                            👨‍🏫 Teacher Evaluation & Remarks:
                          </b>
                          <p style={{ margin: 0, fontSize: '14px', color: '#14532d', fontStyle: 'italic', lineHeight: 1.5 }}>
                            "{vivaOverallResult.teacherFeedback || 'Good effort and clear understanding of core concepts.'}"
                          </p>
                          <small style={{ color: '#15803d', fontSize: '11px', display: 'block', marginTop: '6px' }}>
                            Graded by {vivaOverallResult.evaluatedBy || 'Teacher'}
                          </small>
                        </div>
                      ) : (
                        <div style={{ background: '#f8fafc', border: '1.5px solid #cbd5e1', borderRadius: '14px', padding: '16px 20px' }}>
                          <b style={{ color: '#0369a1', fontSize: '14px', display: 'block', marginBottom: '4px' }}>
                            📋 Awaiting Manual Evaluation by Teacher
                          </b>
                          <p style={{ margin: 0, fontSize: '13px', color: '#475569', lineHeight: 1.5 }}>
                            Your oral viva answers have been securely recorded and sent to your teacher's dashboard. No computer auto-grading is performed; your teacher will review your responses and assign your score and feedback.
                          </p>
                        </div>
                      )}

                      {/* Question by Question Breakdown */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <h3 style={{ margin: 0, fontSize: '16px', color: '#0f172a', fontWeight: '800' }}>Your Submitted Answers:</h3>
                        {(vivaOverallResult.questions || vivaOverallResult.questionResults || []).map((qr, qIdx) => (
                          <div key={qIdx} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                              <b style={{ fontSize: '14px', color: '#0369a1' }}>Question {qr.questionNum || qIdx + 1}: {qr.questionText || qr.text}</b>
                              <span style={{ 
                                background: vivaOverallResult.status === 'Evaluated' ? '#dcfce7' : '#fef3c7', 
                                color: vivaOverallResult.status === 'Evaluated' ? '#15803d' : '#b45309', 
                                padding: '3px 10px', 
                                borderRadius: '8px', 
                                fontSize: '12px', 
                                fontWeight: '800', 
                                whiteSpace: 'nowrap' 
                              }}>
                                {vivaOverallResult.status === 'Evaluated' ? '✓ Graded' : '⏳ Pending Grade'}
                              </span>
                            </div>
                            <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#334155' }}>
                              <b style={{ color: '#0f172a' }}>Your Answer: </b>
                              <span>{qr.studentAnswer || qr.answer || 'No answer submitted'}</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Action Buttons */}
                      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
                        <button
                          type="button"
                          onClick={handleRestartViva}
                          onMouseEnter={() => speakHover("Retake This Viva button. Start practice again from question 1.")}
                          style={{ background: '#0284c7', color: '#ffffff', border: 'none', padding: '12px 24px', borderRadius: '12px', fontWeight: '800', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                          <Repeat size={16} /> 🔄 Retake This Viva
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (vivaOverallResult.status === 'Evaluated') {
                              const summaryText = `Your oral viva has been evaluated by your teacher. You received a score of ${vivaOverallResult.teacherScore} out of 10. Teacher remarks: ${vivaOverallResult.teacherFeedback || 'Good job'}.`;
                              speakText(summaryText);
                            } else {
                              const ansList = (vivaOverallResult.questions || []).map(q => `For question ${q.questionNum}: you entered: ${q.studentAnswer}`).join('. ');
                              const summaryText = `Your viva has been submitted to your teacher for manual evaluation. ${ansList}`;
                              speakText(summaryText);
                            }
                          }}
                          onMouseEnter={() => speakHover("Read Submission Summary Aloud button")}
                          style={{ background: '#f0fdf4', color: '#166534', border: '1.5px solid #bbf7d0', padding: '12px 20px', borderRadius: '12px', fontWeight: '800', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                          <Volume2 size={16} /> 🔊 {vivaOverallResult.status === 'Evaluated' ? 'Read Teacher Evaluation Aloud' : 'Read My Submitted Answers Aloud'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Active Viva Question & Answering Card */
                    <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '20px', padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <label style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a' }}>{activeSubject} Viva Topic:</label>
                          <select 
                            value={vivaSubject} 
                            onChange={(e) => { 
                              if (isVivaDictatingRef.current) stopVivaDictation(false);
                              setVivaSubject(e.target.value); 
                              setVivaQIndex(0); 
                              setVivaFeedback(null); 
                              setVivaAnswerInput(''); 
                              setVivaAnswersRecord({});
                            }}
                            onMouseEnter={() => speakHover(`Current viva topic: ${vivaSubject}. Click to select a different topic.`)}
                            style={{ padding: '8px 14px', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}
                          >
                            {filteredOralVivas.map(v => (
                              <option key={v.id} value={v.title || v.subject}>
                                {v.title ? `${v.title} (${v.subject})` : v.subject}
                              </option>
                            ))}
                          </select>
                        </div>

                        {currentVivaQ && (
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <button 
                              type="button"
                              onClick={handleRepeatVivaQuestion}
                              onMouseEnter={() => speakHover("Repeat Question button. Hear current viva question read aloud.")}
                              style={{ background: '#e0f2fe', color: '#0284c7', border: 'none', padding: '10px 18px', borderRadius: '10px', fontWeight: '800', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                            >
                              <Volume2 size={16} /> 🔄 Repeat Question
                            </button>
                          </div>
                        )}
                      </div>

                      {currentVivaQ && (
                        <div style={{ background: '#f8fafc', border: '1.5px solid #bae6fd', borderRadius: '16px', padding: '20px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <span style={{ fontSize: '12px', fontWeight: '800', color: '#0284c7', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                              QUESTION {activeVivaQIdx + 1} OF {currentVivaQList.length}
                            </span>
                            <span style={{ fontSize: '12px', background: vivaAnswersRecord[activeVivaQIdx] ? '#dcfce7' : '#f1f5f9', color: vivaAnswersRecord[activeVivaQIdx] ? '#15803d' : '#64748b', padding: '2px 8px', borderRadius: '6px', fontWeight: '700' }}>
                              {vivaAnswersRecord[activeVivaQIdx] ? '✓ Answer Recorded' : 'Pending Response'}
                            </span>
                          </div>
                          <h3 style={{ fontSize: '19px', fontWeight: '800', margin: 0, color: '#0f172a', lineHeight: 1.4 }}>
                            {currentVivaQ.text}
                          </h3>
                        </div>
                      )}

                      {/* Voice Answer Input Box */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                          <label style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>Your Oral Response (Voice Dictation / Typed Answer):</span>
                            {isVivaDictating && (
                              <span style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '800', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                🔴 Listening... Say "DONE" to finish
                              </span>
                            )}
                          </label>
                          <button 
                            type="button"
                            onClick={() => {
                              if (isVivaDictating) {
                                stopVivaDictation(true);
                              } else {
                                startVivaDictation();
                              }
                            }}
                            onMouseEnter={() => speakHover(isVivaDictating ? "Stop Microphone Dictation button" : "Start Microphone Dictation button. Click to speak your answer until you say done.")}
                            style={{ 
                              background: isVivaDictating ? '#dc2626' : '#7c3aed', 
                              color: '#fff', 
                              border: 'none', 
                              padding: '8px 16px', 
                              borderRadius: '8px', 
                              fontWeight: '800', 
                              fontSize: '12px', 
                              cursor: 'pointer', 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '6px',
                              boxShadow: isVivaDictating ? '0 0 12px rgba(220, 38, 38, 0.4)' : '0 2px 6px rgba(124, 58, 237, 0.25)',
                              transition: 'all 0.2s ease'
                            }}
                          >
                            {isVivaDictating ? (
                              <>
                                <span>⏹</span> Stop Dictation & Read Back
                              </>
                            ) : (
                              <>
                                <Mic size={14} /> 🎙️ Start Microphone Dictation
                              </>
                            )}
                          </button>
                        </div>

                        <textarea 
                          rows={4}
                          placeholder="Tap here or click 'Start Microphone Dictation' to speak your answer aloud (assistant listens continuously until you say 'DONE'). You can also type your answer here..."
                          value={vivaAnswerInput}
                          onClick={handleAnswerBoxFocusOrClick}
                          onFocus={handleAnswerBoxFocusOrClick}
                          onBlur={handleVivaTextareaBlur}
                          onKeyDown={handleVivaTextareaKeyDown}
                          onChange={(e) => setVivaAnswerInput(e.target.value)}
                          onMouseEnter={() => speakHover("Oral viva answer box. Tap to speak your answer until you say done, or type your answer.")}
                          style={{ 
                            width: '100%', 
                            padding: '16px', 
                            borderRadius: '14px', 
                            border: isVivaDictating ? '2px solid #ef4444' : '1.5px solid #cbd5e1', 
                            fontSize: '15px', 
                            fontWeight: '500', 
                            boxSizing: 'border-box',
                            outline: 'none',
                            background: isVivaDictating ? '#fff5f5' : '#ffffff',
                            color: '#0f172a',
                            boxShadow: isVivaDictating ? '0 0 14px rgba(239, 68, 68, 0.25)' : 'none',
                            transition: 'all 0.2s ease'
                          }}
                        />

                        {/* Helper Guidance Badge for Blind Students */}
                        <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                          <span style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            💡 <b>Auditory Screen Reader:</b> Tap the box to start speaking. Speak freely — assistant listens until you say <b>"DONE"</b>. Then it reads back your answer!
                          </span>
                          {vivaAnswerInput && (
                            <button
                              type="button"
                              onClick={() => speakText(`Your current recorded answer is: ${vivaAnswerInput}`)}
                              onMouseEnter={() => speakHover("Read my answer aloud button")}
                              style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: '12px', fontWeight: '700', cursor: 'pointer', textDecoration: 'underline' }}
                            >
                              🔊 Read Answer Aloud
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Primary Viva Actions Bar: Repeat Question, Next Question, Previous Question, Submit Button */}
                      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginTop: '6px' }}>
                        
                        {/* Repeat Question Button */}
                        <button 
                          type="button"
                          onClick={handleRepeatVivaQuestion}
                          onMouseEnter={() => speakHover("Repeat Question button. Hear current viva question read aloud.")}
                          style={{ 
                            background: '#e0f2fe', 
                            color: '#0369a1', 
                            border: '1.5px solid #bae6fd', 
                            padding: '14px 20px', 
                            borderRadius: '12px', 
                            fontWeight: '800', 
                            fontSize: '14px', 
                            cursor: 'pointer', 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '6px' 
                          }}
                        >
                          <Repeat size={16} /> 🔄 Repeat Question
                        </button>

                        {/* Previous Question Button */}
                        {activeVivaQIdx > 0 && (
                          <button 
                            type="button"
                            onClick={handlePrevVivaQuestion}
                            onMouseEnter={() => speakHover("Previous Question button. Go back to previous viva question.")}
                            style={{ 
                              background: '#f8fafc', 
                              border: '1px solid #cbd5e1', 
                              color: '#334155', 
                              padding: '14px 18px', 
                              borderRadius: '12px', 
                              fontWeight: '800', 
                              fontSize: '14px', 
                              cursor: 'pointer' 
                            }}
                          >
                            ← Previous Question
                          </button>
                        )}

                        {/* Next Question Button */}
                        {activeVivaQIdx < currentVivaQList.length - 1 && (
                          <button 
                            type="button"
                            onClick={handleNextVivaQuestion}
                            onMouseEnter={() => speakHover("Next Question button. Advance to next viva question.")}
                            style={{ 
                              background: '#0284c7', 
                              border: 'none', 
                              color: '#ffffff', 
                              padding: '14px 24px', 
                              borderRadius: '12px', 
                              fontWeight: '800', 
                              fontSize: '14px', 
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)'
                            }}
                          >
                            <span>Next Question →</span>
                          </button>
                        )}

                        {/* Submit Viva Exam Button */}
                        <button 
                          type="button"
                          onClick={handleSubmitVivaExam}
                          onMouseEnter={() => speakHover("Submit Oral Viva button. Complete your viva exam and send your answers to your teacher for grading.")}
                          style={{ 
                            background: '#16a34a', 
                            color: '#ffffff', 
                            border: 'none', 
                            padding: '14px 28px', 
                            borderRadius: '12px', 
                            fontWeight: '900', 
                            fontSize: '15px', 
                            cursor: 'pointer', 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '8px',
                            boxShadow: '0 4px 14px rgba(22, 163, 74, 0.35)',
                            marginLeft: 'auto'
                          }}
                        >
                          <span>📤 Submit Viva Exam</span>
                          {activeVivaQIdx === currentVivaQList.length - 1 && (
                            <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.25)', padding: '2px 8px', borderRadius: '8px' }}>Final</span>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </>
          ) : (
            <div style={{ background: '#ffffff', border: '1px dashed #cbd5e1', borderRadius: '20px', padding: '48px 24px', textAlign: 'center' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#e0f2fe', display: 'grid', placeItems: 'center', margin: '0 auto 16px auto' }}>
                <Sparkles size={28} color="#0284c7" />
              </div>
              <h2 style={{ fontSize: '20px', color: '#0f172a', margin: '0 0 8px 0', fontWeight: '800' }}>No Teacher-Assigned Oral Vivas Yet</h2>
              <p style={{ color: '#64748b', fontSize: '14px', maxWidth: '480px', margin: '0 auto 16px auto', lineHeight: 1.5 }}>
                Your teacher has not published any oral viva exam. Once your teacher publishes an oral viva from the Teacher Dashboard, it will appear here immediately for practice.
              </p>
            </div>
          )}
        </div>
      )}

          {/* TAB 3: 📝 MY EXAMS */}
          {activeTab === 'My Exams' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <h1 style={{ margin: 0, fontSize: '22px', color: '#0369a1', fontWeight: '800' }}>
                  📝 My Exams ({activeSubject})
                </h1>
                <span style={{ fontSize: '13px', background: '#e0f2fe', color: '#0284c7', padding: '6px 14px', borderRadius: '12px', fontWeight: '800' }}>
                  Filtered by Interest: {activeSubject}
                </span>
              </div>
              <div style={{ display: 'grid', gap: '16px' }}>
                {filteredExams.length > 0 ? (
                  filteredExams.map(ex => (
                    <div 
                      key={ex.id} 
                      onMouseEnter={() => speakHover(`Written Exam: ${ex.title}. Subject: ${ex.subject}. Status: ${ex.status}. Duration: ${ex.duration}.`)}
                      data-speech={`Written Exam: ${ex.title}. Subject: ${ex.subject}. Status: ${ex.status}. Duration: ${ex.duration}.`}
                      data-narrate={`Written Exam: ${ex.title}. Subject: ${ex.subject}. Status: ${ex.status}.`}
                      style={{ background: ex.targetStudentEmail ? '#f0fdf4' : '#ffffff', border: ex.targetStudentEmail ? '2px solid #86efac' : '1px solid #e2e8f0', borderRadius: '16px', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: ex.targetStudentEmail ? '0 4px 12px rgba(22, 163, 74, 0.1)' : 'none' }}
                    >
                      <div>
                        {(ex.targetStudentEmail || ex.targetStudentName || (student.name && ex.title?.toLowerCase().includes(student.name.toLowerCase()))) && (
                          <span style={{ display: 'inline-block', background: '#dcfce7', color: '#15803d', padding: '3px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '800', marginBottom: '6px' }}>
                            🎯 Personalized Exam for You ({ex.subject})
                          </span>
                        )}
                        <b style={{ fontSize: '16px', color: '#0f172a', display: 'block' }}>{ex.title}</b>
                        <p style={{ margin: '4px 0', fontSize: '13px', color: '#64748b' }}>
                          {ex.subject} • Date: {formatDateForVoice(ex.date)} • Time: {ex.startTime || ex.time}{ex.endTime ? ` - ${ex.endTime}` : ''} • Duration: {ex.duration}
                        </p>
                        <small style={{ fontSize: '12px', color: ex.status === 'Active' ? '#16a34a' : '#0284c7', fontWeight: '700' }}>
                          Status: {ex.status}
                        </small>
                      </div>
                      <button 
                        onClick={() => startExamHandler(ex)} 
                        onMouseEnter={() => speakHover(`${ex.status === 'Active' ? 'Start Written Exam' : 'View Schedule'} button for ${ex.title}`)}
                        data-speech={`${ex.status === 'Active' ? 'Start Written Exam' : 'View Schedule'} button for ${ex.title}`}
                        data-narrate={`${ex.status === 'Active' ? 'Start Written Exam' : 'View Schedule'} button for ${ex.title}`}
                        aria-label={`${ex.status === 'Active' ? 'Start Written Exam' : 'View Schedule'} button for ${ex.title}`}
                        style={{ background: '#0284c7', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}
                      >
                        {ex.status === 'Active' ? 'Start Written Exam' : 'View Schedule'}
                      </button>
                    </div>
                  ))
                ) : (
                  <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '40px', textAlign: 'center', color: '#64748b' }}>
                    <Calendar size={48} color="#94a3b8" style={{ marginBottom: '12px' }} />
                    <h3 style={{ margin: 0, fontSize: '16px', color: '#0f172a' }}>No {activeSubject} Exams Scheduled</h3>
                    <p style={{ margin: '4px 0 0 0', fontSize: '13px' }}>Your teacher has not published any active or scheduled exams for {activeSubject} yet.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: 📊 RESULTS & PERFORMANCE */}
          {activeTab === 'Results & Performance' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ background: 'linear-gradient(135deg, #0369a1 0%, #0284c7 100%)', padding: '24px', borderRadius: '20px', color: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <h1 style={{ margin: '0 0 6px 0', fontSize: '22px', fontWeight: '800' }}>📊 Results & Performance Reports ({activeSubject})</h1>
                  <p style={{ margin: 0, fontSize: '13px', color: '#e0f2fe' }}>
                    Overall Progress: <strong>{filteredResults.length > 0 ? `${overallProgress}%` : 'N/A'}</strong> • Written Exams: <strong>{filteredResults.length}</strong> • Oral Vivas: <strong>{studentVivaResults.length}</strong>
                  </p>
                </div>
                <button 
                  onClick={handleReadPerformanceReport}
                  style={{ background: '#ffffff', color: '#0369a1', border: 'none', padding: '12px 20px', borderRadius: '12px', fontWeight: '800', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
                >
                  <Volume2 size={18} /> 🔊 Listen Performance Report Aloud
                </button>
              </div>

              {/* Assessment Type Filter Bar */}
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '12px 16px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#64748b' }}>Filter Assessment Type:</span>
                <button
                  type="button"
                  onClick={() => setStudentResultsFilter('all')}
                  onMouseEnter={() => speakHover(`All assessments filter button. Showing ${filteredResults.length + studentVivaResults.length} total assessments.`)}
                  data-speech={`All assessments filter button. Showing ${filteredResults.length + studentVivaResults.length} total assessments.`}
                  data-narrate={`All assessments filter button. Showing ${filteredResults.length + studentVivaResults.length} total assessments.`}
                  aria-label="All assessments filter"
                  style={{
                    background: studentResultsFilter === 'all' ? '#0369a1' : '#f1f5f9',
                    color: studentResultsFilter === 'all' ? '#ffffff' : '#334155',
                    border: 'none',
                    padding: '6px 14px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  All ({filteredResults.length + studentVivaResults.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStudentResultsFilter('written')}
                  onMouseEnter={() => speakHover(`Written Exams filter button. Currently showing ${filteredResults.length} completed written exams and teacher evaluations.`)}
                  data-speech={`Written Exams filter button. Currently showing ${filteredResults.length} completed written exams and teacher evaluations.`}
                  data-narrate={`Written Exams filter button. Currently showing ${filteredResults.length} completed written exams and teacher evaluations.`}
                  aria-label="Written Exams filter button"
                  title="Written Exams"
                  style={{
                    background: studentResultsFilter === 'written' ? '#0284c7' : '#f1f5f9',
                    color: studentResultsFilter === 'written' ? '#ffffff' : '#334155',
                    border: 'none',
                    padding: '6px 14px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  📝 Written Exams ({filteredResults.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStudentResultsFilter('viva')}
                  onMouseEnter={() => speakHover(`Oral Viva Voce filter button. Currently showing ${studentVivaResults.length} oral viva recordings and teacher scores.`)}
                  data-speech={`Oral Viva Voce filter button. Currently showing ${studentVivaResults.length} oral viva recordings and teacher scores.`}
                  data-narrate={`Oral Viva Voce filter button. Currently showing ${studentVivaResults.length} oral viva recordings and teacher scores.`}
                  aria-label="Oral Viva Voce filter button"
                  title="Oral Viva Voce"
                  style={{
                    background: studentResultsFilter === 'viva' ? '#7c3aed' : '#f1f5f9',
                    color: studentResultsFilter === 'viva' ? '#ffffff' : '#334155',
                    border: 'none',
                    padding: '6px 14px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  🎙️ Oral Viva Voce ({studentVivaResults.length})
                </button>
              </div>

              {/* EMPTY STATE */}
              {((studentResultsFilter === 'all' && filteredResults.length === 0 && studentVivaResults.length === 0) ||
                (studentResultsFilter === 'written' && filteredResults.length === 0) ||
                (studentResultsFilter === 'viva' && studentVivaResults.length === 0)) ? (
                <div style={{ background: '#ffffff', border: '1px dashed #cbd5e1', borderRadius: '16px', padding: '40px 20px', textAlign: 'center', color: '#64748b' }}>
                  <BarChart2 size={48} color="#94a3b8" style={{ marginBottom: '12px' }} />
                  <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', color: '#334155', fontWeight: '700' }}>
                    No Completed {activeSubject} {studentResultsFilter === 'viva' ? 'Oral Vivas' : studentResultsFilter === 'written' ? 'Written Exams' : 'Assessments'} Yet
                  </h3>
                  <p style={{ margin: '0 0 16px 0', fontSize: '14px', maxWidth: '520px', marginInline: 'auto' }}>
                    Exams and viva recordings submitted by you will show up here along with your teacher's marks, evaluation feedback, and voice notes.
                  </p>
                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => setActiveTab('AI Exam Assistant')}
                      onMouseEnter={() => speakHover("Take Written Exam button. Open AI Exam Assistant to begin your written assessment.")}
                      data-speech="Take Written Exam button. Open AI Exam Assistant to begin your written assessment."
                      data-narrate="Take Written Exam button. Open AI Exam Assistant to begin your written assessment."
                      aria-label="Take Written Exam"
                      style={{ background: '#0284c7', color: '#ffffff', border: 'none', padding: '10px 20px', borderRadius: '10px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}
                    >
                      📝 Take Written Exam
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('AI Oral Viva Simulator')}
                      onMouseEnter={() => speakHover("Take Oral Viva button. Open AI Oral Viva Simulator to practice.")}
                      data-speech="Take Oral Viva button. Open AI Oral Viva Simulator to practice."
                      data-narrate="Take Oral Viva button. Open AI Oral Viva Simulator to practice."
                      aria-label="Take Oral Viva"
                      style={{ background: '#7c3aed', color: '#ffffff', border: 'none', padding: '10px 20px', borderRadius: '10px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}
                    >
                      🎙️ Take Oral Viva
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '16px' }}>
                  {/* WRITTEN EXAMS LIST */}
                  {(studentResultsFilter === 'all' || studentResultsFilter === 'written') &&
                    filteredResults.map((res, rIdx) => {
                      const isEvaluated = res.status === 'Corrected & Graded' || Boolean(res.evaluatedAt);
                      const evaluatorTitle = res.evaluatedBy || res.teacherName || 'Course Instructor';

                      return (
                        <div
                          key={res.id || `written_res_${rIdx}`}
                          onMouseEnter={() => speakHover(`Written Exam result for ${res.examName}. Score: ${res.score} out of ${res.total}. Evaluated by respected teacher ${evaluatorTitle}.`)}
                          data-speech={`Written Exam result for ${res.examName}. Score: ${res.score} out of ${res.total}. Evaluated by respected teacher ${evaluatorTitle}. Teacher note: ${res.feedback || (isEvaluated ? 'Exam evaluated by teacher with full technical review.' : 'Pending teacher review.')}`}
                          data-narrate={`Written Exam result for ${res.examName}. Score: ${res.score} out of ${res.total}. Evaluated by respected teacher ${evaluatorTitle}.`}
                          style={{
                            background: isEvaluated ? '#f0fdf4' : '#ffffff',
                            border: isEvaluated ? '1.5px solid #86efac' : '1.5px solid #fde68a',
                            borderRadius: '16px',
                            padding: '20px',
                            boxShadow: isEvaluated ? '0 2px 8px rgba(22, 163, 74, 0.08)' : '0 4px 12px rgba(245, 158, 11, 0.08)'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '18px' }}>📝</span>
                                <b style={{ fontSize: '16px', color: '#0f172a' }}>{res.examName}</b>
                                <span
                                  style={{
                                    fontSize: '11px',
                                    background: isEvaluated ? '#dcfce7' : '#fef3c7',
                                    color: isEvaluated ? '#15803d' : '#b45309',
                                    border: `1px solid ${isEvaluated ? '#86efac' : '#fde68a'}`,
                                    padding: '3px 10px',
                                    borderRadius: '8px',
                                    fontWeight: '800'
                                  }}
                                >
                                  {isEvaluated ? `✅ Evaluated by Teacher (${evaluatorTitle})` : '🟡 Submitted — Awaiting Teacher Evaluation'}
                                </span>
                              </div>
                              <p style={{ margin: '4px 0', fontSize: '13px', color: '#64748b' }}>
                                {res.subject} • Submitted: {res.submittedAt || res.date} • Duration: {res.timeSpent || '45 mins'}
                              </p>
                            </div>

                            <div style={{ textAlign: 'right' }}>
                              <span style={{ fontSize: '20px', fontWeight: '900', color: isEvaluated ? '#16a34a' : '#b45309' }}>
                                {res.score}/{res.total}
                              </span>
                              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold' }}>
                                {isEvaluated ? `${res.percentage || Math.round(((res.score || 0) / (res.total || 100)) * 100)}% Published` : 'Preliminary Score'}
                              </div>
                            </div>
                          </div>

                          {/* Teacher Feedback Card */}
                          <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', marginTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                            <div style={{ fontSize: '13px', color: '#334155', flex: 1 }}>
                              <strong style={{ color: '#0369a1' }}>Teacher Evaluation Note:</strong> {res.feedback || (isEvaluated ? 'Exam evaluated by teacher with full technical review.' : 'Exam received. Pending teacher final review.')}
                            </div>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                speakText(`Teacher Feedback for ${res.examName} by respected teacher ${evaluatorTitle}: ${res.feedback || 'Exam evaluated by teacher with full technical review.'}`);
                              }}
                              onMouseEnter={() => speakHover(`Listen teacher evaluation feedback button for ${res.examName} by respected teacher ${evaluatorTitle}.`)}
                              data-speech={`Listen teacher evaluation feedback button for ${res.examName} by respected teacher ${evaluatorTitle}.`}
                              data-narrate={`Listen teacher evaluation feedback button for ${res.examName} by respected teacher ${evaluatorTitle}.`}
                              aria-label={`Listen teacher evaluation feedback for ${res.examName}`}
                              style={{ background: '#e0f2fe', color: '#0284c7', border: 'none', padding: '6px 14px', borderRadius: '8px', fontWeight: '800', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                            >
                              <Volume2 size={14} /> 🔊 Listen Feedback
                            </button>
                          </div>
                        </div>
                      );
                    })}

                  {/* ORAL VIVA VOCE RESULTS LIST */}
                  {(studentResultsFilter === 'all' || studentResultsFilter === 'viva') &&
                    studentVivaResults.map((vSub, vIdx) => {
                      const isEvaluated = vSub.status === 'Evaluated' || (vSub.teacherScore !== null && vSub.teacherScore !== undefined);
                      const evaluatorTitle = vSub.evaluatedBy || vSub.teacherName || 'Teacher';
                      const spokenAns = vSub.response || vSub.spokenResponse || vSub.transcript || vSub.questions?.[0]?.studentAnswer || 'Recorded spoken response';

                      return (
                        <div
                          key={vSub.id || `viva_res_${vIdx}`}
                          onMouseEnter={() => speakHover(`Oral Viva result for ${vSub.vivaTitle || vSub.subject || 'Oral Viva'}. ${isEvaluated ? `Score: ${vSub.teacherScore} out of 10. Evaluated by respected teacher ${evaluatorTitle}.` : 'Awaiting teacher evaluation.'}`)}
                          data-speech={`Oral Viva result for ${vSub.vivaTitle || vSub.subject || 'Oral Viva'}. ${isEvaluated ? `Score: ${vSub.teacherScore} out of 10. Grade: ${vSub.gradeStatus || 'Pass'}. Evaluated by respected teacher ${evaluatorTitle}. Feedback: ${vSub.teacherFeedback || 'Good performance.'}` : 'Awaiting teacher evaluation.'}`}
                          data-narrate={`Oral Viva result for ${vSub.vivaTitle || vSub.subject || 'Oral Viva'}. ${isEvaluated ? `Score: ${vSub.teacherScore} out of 10. Evaluated by respected teacher ${evaluatorTitle}.` : 'Awaiting teacher evaluation.'}`}
                          style={{
                            background: isEvaluated ? '#f0fdf4' : '#ffffff',
                            border: isEvaluated ? '1.5px solid #86efac' : '1.5px solid #ddd6fe',
                            borderRadius: '16px',
                            padding: '20px',
                            boxShadow: isEvaluated ? '0 2px 8px rgba(22, 163, 74, 0.08)' : '0 4px 12px rgba(124, 58, 237, 0.08)'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '18px' }}>🎙️</span>
                                <b style={{ fontSize: '16px', color: '#0f172a' }}>{vSub.vivaTitle || `${vSub.subject} Oral Viva`}</b>
                                <span
                                  style={{
                                    fontSize: '11px',
                                    background: isEvaluated ? '#dcfce7' : '#ede9fe',
                                    color: isEvaluated ? '#15803d' : '#6d28d9',
                                    border: `1px solid ${isEvaluated ? '#86efac' : '#ddd6fe'}`,
                                    padding: '3px 10px',
                                    borderRadius: '8px',
                                    fontWeight: '800'
                                  }}
                                >
                                  {isEvaluated ? `✅ Viva Evaluated by Teacher (${evaluatorTitle})` : '🟡 Spoken Viva Submitted — Awaiting Teacher Evaluation'}
                                </span>
                              </div>
                              <p style={{ margin: '4px 0', fontSize: '13px', color: '#64748b' }}>
                                {vSub.subject} • Submitted: {vSub.date} {vSub.time ? `at ${vSub.time}` : ''}
                              </p>
                            </div>

                            <div style={{ textAlign: 'right' }}>
                              <span style={{ fontSize: '20px', fontWeight: '900', color: isEvaluated ? '#16a34a' : '#7c3aed' }}>
                                {isEvaluated ? `${vSub.teacherScore}/10` : 'In Review'}
                              </span>
                              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold' }}>
                                {isEvaluated ? `Grade: ${vSub.gradeStatus || 'Pass'}` : 'Awaiting Score'}
                              </div>
                            </div>
                          </div>

                          {/* Student Spoken Answer Preview */}
                          <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e2e8f0', marginTop: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                            <div style={{ fontSize: '12px', color: '#334155', flex: 1, fontStyle: 'italic' }}>
                              <strong style={{ fontStyle: 'normal', color: '#7c3aed' }}>Your Recorded Spoken Answer:</strong> "{spokenAns}"
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                speakText(`Your recorded viva response: ${spokenAns}`);
                              }}
                              style={{ background: '#ede9fe', color: '#7c3aed', border: 'none', padding: '5px 12px', borderRadius: '8px', fontWeight: '700', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                              <Volume2 size={13} /> 🔊 Listen Audio
                            </button>
                          </div>

                          {/* Teacher Feedback Note (if evaluated) */}
                          {isEvaluated && (
                            <div style={{ background: '#f0fdf4', padding: '12px', borderRadius: '10px', border: '1px solid #86efac', marginTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                              <div style={{ fontSize: '13px', color: '#166534', flex: 1 }}>
                                <strong>🎓 Teacher Evaluation Feedback:</strong> {vSub.teacherFeedback || 'Oral performance and technical fluency evaluated by teacher.'}
                              </div>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  speakText(`Teacher Viva Feedback by respected teacher ${evaluatorTitle}: ${vSub.teacherFeedback || 'Good performance in oral examination.'}`);
                                }}
                                onMouseEnter={() => speakHover(`Listen teacher viva evaluation feedback by respected teacher ${evaluatorTitle}.`)}
                                data-speech={`Listen teacher viva evaluation feedback by respected teacher ${evaluatorTitle}.`}
                                data-narrate={`Listen teacher viva evaluation feedback by respected teacher ${evaluatorTitle}.`}
                                aria-label="Listen teacher viva feedback"
                                style={{ background: '#dcfce7', color: '#15803d', border: 'none', padding: '6px 14px', borderRadius: '8px', fontWeight: '800', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                              >
                                <Volume2 size={14} /> 🔊 Listen Feedback
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: 📚 STUDY MATERIALS & AI VOICE TUTOR */}
          {activeTab === 'Study Materials' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Header Banner */}
              <div style={{ background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', padding: '28px', borderRadius: '20px', color: '#ffffff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <span style={{ fontSize: '12px', background: 'rgba(255,255,255,0.2)', padding: '4px 12px', borderRadius: '12px', fontWeight: '800' }}>
                      📖 Study Materials & Voice AI Tutor
                    </span>
                    <h1 style={{ margin: '12px 0 8px 0', fontSize: '26px', fontWeight: '900' }}>Accessible Audio Lessons & Practice</h1>
                    <p style={{ margin: 0, fontSize: '14px', color: '#e0f2fe', lineHeight: 1.5 }}>
                      Listen aloud to audio lessons uploaded by your teachers, ask the AI Tutor to summarize concepts, and save audio bookmarks!
                    </p>
                  </div>
                  <button 
                    onClick={() => speakText(`Study Materials Section. You have ${filteredStudyMaterials.length} ${activeSubject} lessons available. Click Listen Aloud to hear any lesson narrated.`)}
                    style={{ background: '#ffffff', color: '#0369a1', border: 'none', padding: '10px 18px', borderRadius: '12px', fontWeight: '800', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Volume2 size={16} /> Read Section Info
                  </button>
                </div>
              </div>

              {/* PDF & Document Voice Reader Controls Bar (Feature 2 & Feature 5) */}
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '16px 20px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <label style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a' }}>🎙️ Voice Speed:</label>
                  <select 
                    value={accessibility.speechRate} 
                    onChange={(e) => setAccessibility({ ...accessibility, speechRate: parseFloat(e.target.value) })}
                    style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: '700' }}
                  >
                    <option value={0.75}>0.75x (Slower / Clear)</option>
                    <option value={1.0}>1.0x (Normal Speed)</option>
                    <option value={1.25}>1.25x (Faster Speed)</option>
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button 
                    onClick={() => handleGenerateAiConceptSummary(activePracticeMat || filteredStudyMaterials[0])}
                    style={{ background: '#7c3aed', color: '#ffffff', border: 'none', padding: '8px 16px', borderRadius: '10px', fontWeight: '800', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    🤖 Ask AI Tutor / Summarize
                  </button>
                  <button 
                    onClick={() => handleSaveBookmark(activePracticeMat?.title || filteredStudyMaterials[0]?.title)}
                    style={{ background: '#f59e0b', color: '#ffffff', border: 'none', padding: '8px 16px', borderRadius: '10px', fontWeight: '800', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    ⭐ Save Audio Bookmark
                  </button>
                </div>
              </div>

              {/* AI Concept Summary Card (Feature 2) */}
              {aiConceptSummary && (
                <div style={{ background: '#faf5ff', border: '2px solid #a855f7', borderRadius: '16px', padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <b style={{ color: '#6b21a8', fontSize: '15px' }}>🤖 AI Tutor Concept Summary:</b>
                    <button 
                      onClick={() => speakText(aiConceptSummary)}
                      style={{ background: '#9333ea', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '8px', fontWeight: '800', fontSize: '12px', cursor: 'pointer' }}
                    >
                      🔊 Listen Summary Aloud
                    </button>
                  </div>
                  <p style={{ margin: 0, fontSize: '14px', color: '#4c1d95', lineHeight: 1.5 }}>{aiConceptSummary}</p>
                </div>
              )}

              {/* My Saved Audio Bookmarks List (Feature 5) */}
              {audioBookmarks.length > 0 && (
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px' }}>
                  <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#0f172a', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    ⭐ My Saved Audio Bookmarks ({audioBookmarks.length})
                  </h3>
                  <div style={{ display: 'grid', gap: '10px' }}>
                    {audioBookmarks.map(bm => (
                      <div key={bm.id} style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                        <div>
                          <strong style={{ fontSize: '14px', color: '#92400e' }}>{bm.title}</strong>
                          <span style={{ fontSize: '11px', color: '#b45309', marginLeft: '10px' }}>Saved on {bm.date} ({bm.timestamp})</span>
                          <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#78350f' }}>{bm.note}</p>
                        </div>
                        <button 
                          onClick={() => speakText(`Audio Bookmark for ${bm.title}: ${bm.note}`)}
                          style={{ background: '#d97706', color: '#ffffff', border: 'none', padding: '6px 14px', borderRadius: '8px', fontWeight: '800', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                          <Volume2 size={14} /> 🔊 Play Bookmark
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Search & Subject Filter Bar */}
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '16px 20px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                <input 
                  type="text" 
                  placeholder="Search study materials or topics..." 
                  value={studyQuery} 
                  onChange={(e) => setStudyQuery(e.target.value)} 
                  style={{ flex: 1, minWidth: '220px', padding: '10px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px' }} 
                />
                <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '700' }}>
                  {filteredStudyMaterials.filter(m => !studyQuery || m.title.toLowerCase().includes(studyQuery.toLowerCase()) || (m.subject && m.subject.toLowerCase().includes(studyQuery.toLowerCase()))).length} {activeSubject} Lessons Available
                </span>
              </div>

              {/* Voice Practice Active Card / Modal */}
              {activePracticeMat && (() => {
                const questionsList = (activePracticeMat.questions && activePracticeMat.questions.length > 0)
                  ? activePracticeMat.questions
                  : [{
                      id: 1,
                      text: activePracticeMat.practiceQuestion || `Explain core concepts of ${activePracticeMat.title}`,
                      oneLineAnswer: activePracticeMat.oneLineAnswer || activePracticeMat.practiceAnswer || activePracticeMat.correctAnswer || activePracticeMat.detail,
                      explanation: activePracticeMat.explanation || activePracticeMat.textContent
                    }];
                const safeQIdx = Math.min(practiceQIdx, questionsList.length - 1);
                const currentQ = questionsList[safeQIdx] || questionsList[0];

                return (
                  <div style={{ background: '#faf5ff', border: '2px solid #c084fc', borderRadius: '20px', padding: '28px', boxShadow: '0 8px 24px rgba(168, 85, 247, 0.15)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <div>
                        <span style={{ fontSize: '11px', background: '#f3e8ff', color: '#7e22ce', padding: '4px 10px', borderRadius: '8px', fontWeight: '800', textTransform: 'uppercase' }}>
                          🎙️ Voice AI Tutor Practice (Question {safeQIdx + 1} of {questionsList.length})
                        </span>
                        <h2 style={{ fontSize: '20px', color: '#581c87', margin: '6px 0 0 0', fontWeight: '800' }}>
                          {activePracticeMat.title}
                        </h2>
                      </div>
                      <button 
                        onClick={() => { setActivePracticeMat(null); setPracticeFeedback(null); setPracticeAnswerInput(''); setPracticeQIdx(0); }}
                        style={{ background: '#f3e8ff', border: 'none', color: '#6b21a8', padding: '6px 14px', borderRadius: '8px', fontWeight: '800', cursor: 'pointer' }}
                      >
                        ✕ Close Practice
                      </button>
                    </div>

                    {/* Practice Question Box */}
                    <div style={{ background: '#ffffff', border: '1px solid #e9d5ff', borderRadius: '14px', padding: '20px', marginBottom: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '12px', color: '#7e22ce', fontWeight: '800' }}>
                          PRACTICE QUESTION {safeQIdx + 1} OF {questionsList.length}:
                        </span>
                        <button 
                          onClick={() => handleSpeakQuestionAnswerExplanation(activePracticeMat, safeQIdx)}
                          style={{ background: '#f3e8ff', color: '#6b21a8', border: 'none', padding: '6px 14px', borderRadius: '8px', fontWeight: '800', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <Volume2 size={14} /> Listen Question, Answer & Explanation
                        </button>
                      </div>
                      <h3 style={{ fontSize: '16px', color: '#1e1b4b', margin: 0, fontWeight: '700' }}>
                        {currentQ.text || currentQ.question || activePracticeMat.practiceQuestion || `Explain the core concepts of ${activePracticeMat.title}.`}
                      </h3>
                      {/* Strictly Short Answer or Long Answer - No MCQ Options */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                        <span style={{
                          background: (currentQ.type === 'Long answer' || currentQ.type === 'Descriptive Theory') ? '#f3e8ff' : '#f0fdf4',
                          border: (currentQ.type === 'Long answer' || currentQ.type === 'Descriptive Theory') ? '1px solid #d8b4fe' : '1px solid #86efac',
                          color: (currentQ.type === 'Long answer' || currentQ.type === 'Descriptive Theory') ? '#7e22ce' : '#15803d',
                          padding: '4px 12px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: '800',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          {(currentQ.type === 'Long answer' || currentQ.type === 'Descriptive Theory') ? '📜 Long Answer Question' : '📝 Short Answer Question'}
                        </span>
                        <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>
                          (Answer by Voice Dictation or Text • No MCQ Options)
                        </span>
                      </div>
                    </div>

                    {/* Teacher's Reference Answer & Audio Explanation Box (Accessible for Blind Students) */}
                    <div style={{ background: '#f0f9ff', border: '2px solid #0284c7', borderRadius: '14px', padding: '20px', marginBottom: '20px', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.1)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                        <span style={{ fontSize: '12px', color: '#0369a1', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          💡 TEACHER'S REFERENCE ANSWER & AUDIO EXPLANATION:
                        </span>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSpeakQuestionAnswerExplanation(activePracticeMat, safeQIdx);
                          }}
                          style={{ background: '#0284c7', color: '#ffffff', border: 'none', padding: '6px 14px', borderRadius: '8px', fontWeight: '800', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                          <Volume2 size={14} /> 🔊 Listen Answer & Explanation
                        </button>
                      </div>
                      {/* 1. First Line: One-Line Short Answer */}
                      <div style={{ fontSize: '14px', color: '#15803d', margin: '0 0 10px 0', fontWeight: '800', lineHeight: 1.5, background: '#f0fdf4', padding: '10px 14px', borderRadius: '8px', borderLeft: '4px solid #16a34a' }}>
                        📌 <strong>One-Line Short Answer:</strong> {currentQ.oneLineAnswer || currentQ.correctAnswer || currentQ.answer || activePracticeMat.oneLineAnswer || activePracticeMat.practiceAnswer || activePracticeMat.correctAnswer || activePracticeMat.detail}
                      </div>

                      {/* 2. Next Block: Detailed Long Answer Explanation */}
                      <div style={{ fontSize: '13px', color: '#1e293b', margin: 0, background: '#e0f2fe', padding: '14px 18px', borderRadius: '10px', borderLeft: '4px solid #0284c7', lineHeight: 1.6 }}>
                        📖 <strong>Detailed Long Answer Explanation:</strong> {
                          getDetailedLongExplanation(activePracticeMat.title, currentQ.text || currentQ.question || activePracticeMat.practiceQuestion, currentQ.explanation || activePracticeMat.explanation || activePracticeMat.textContent)
                        }
                      </div>
                    </div>

                    {/* Voice Answer Input & Dictation Button */}
                    <div style={{ marginBottom: '20px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <label style={{ fontSize: '13px', fontWeight: '800', color: '#4c1d95' }}>
                          Your Practice Answer (Voice Dictation / Text):
                        </label>
                        <button 
                          onClick={handleStartVoiceDictationForPractice}
                          style={{ background: '#9333ea', color: '#ffffff', border: 'none', padding: '8px 16px', borderRadius: '10px', fontWeight: '800', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                          <Mic size={14} /> Start Voice Dictation
                        </button>
                      </div>

                      <textarea 
                        rows={4}
                        placeholder="Speak into microphone or type your answer to practice..."
                        value={practiceAnswerInput}
                        onChange={(e) => setPracticeAnswerInput(e.target.value)}
                        style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #d8b4fe', fontSize: '14px', boxSizing: 'border-box' }}
                      />
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                      <button 
                        onClick={() => handleEvaluatePractice()}
                        style={{ background: '#16a34a', color: '#ffffff', border: 'none', padding: '14px 24px', borderRadius: '12px', fontWeight: '800', fontSize: '15px', cursor: 'pointer', flex: 1 }}
                      >
                        ✨ Evaluate Practice Answer
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSpeakQuestionAnswerExplanation(activePracticeMat, safeQIdx);
                        }}
                        style={{ background: '#f3e8ff', color: '#6b21a8', border: '1px solid #d8b4fe', padding: '14px 18px', borderRadius: '12px', fontWeight: '800', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        <Volume2 size={16} /> 🔊 Read Q, Answer & Explanation
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          const newIdx = (safeQIdx - 1 + questionsList.length) % questionsList.length;
                          setPracticeQIdx(newIdx);
                          setPracticeAnswerInput(practiceAnswersByQ[newIdx] || '');
                          setPracticeFeedback(null);
                          handleSpeakQuestionAnswerExplanation(activePracticeMat, newIdx);
                        }}
                        style={{ background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', padding: '14px 16px', borderRadius: '12px', fontWeight: '800', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        ⬅️ Previous Q
                      </button>
                      {safeQIdx >= questionsList.length - 1 ? (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSubmitPracticeToTeacher();
                          }}
                          style={{ background: '#16a34a', color: '#ffffff', border: 'none', padding: '14px 20px', borderRadius: '12px', fontWeight: '900', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 14px rgba(22, 163, 74, 0.3)' }}
                        >
                          🚀 Submit Practice to Teacher (Say "SUBMIT")
                        </button>
                      ) : (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            const newIdx = (safeQIdx + 1) % questionsList.length;
                            setPracticeQIdx(newIdx);
                            setPracticeAnswerInput(practiceAnswersByQ[newIdx] || '');
                            setPracticeFeedback(null);
                            handleSpeakQuestionAnswerExplanation(activePracticeMat, newIdx);
                          }}
                          style={{ background: '#0284c7', color: '#ffffff', border: 'none', padding: '14px 16px', borderRadius: '12px', fontWeight: '800', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                          Next Q ➡️
                        </button>
                      )}
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSpeakQuestionAnswerExplanation(activePracticeMat, safeQIdx);
                        }}
                        style={{ background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', padding: '14px 16px', borderRadius: '12px', fontWeight: '800', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        <Repeat size={16} /> 🔄 Repeat Speech
                      </button>
                    </div>

                    {/* Evaluation Feedback Card with Accurate Badges */}
                    {practiceFeedback && (
                      <div style={{
                        background: practiceFeedback.score >= 8 ? '#f0fdf4' : practiceFeedback.score >= 5 ? '#eff6ff' : '#fef2f2',
                        border: `2px solid ${practiceFeedback.score >= 8 ? '#bbf7d0' : practiceFeedback.score >= 5 ? '#bfdbfe' : '#fecaca'}`,
                        padding: '20px',
                        borderRadius: '16px',
                        marginTop: '20px'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                          <h4 style={{
                            margin: 0,
                            fontSize: '17px',
                            fontWeight: '800',
                            color: practiceFeedback.score >= 8 ? '#166534' : practiceFeedback.score >= 5 ? '#1e40af' : '#991b1b'
                          }}>
                            Practice Score: {practiceFeedback.score} / 10
                          </h4>
                          <span style={{
                            fontSize: '12px',
                            background: practiceFeedback.score >= 8 ? '#dcfce7' : practiceFeedback.score >= 5 ? '#dbeafe' : '#fee2e2',
                            color: practiceFeedback.score >= 8 ? '#15803d' : practiceFeedback.score >= 5 ? '#1d4ed8' : '#b91c1c',
                            padding: '4px 10px',
                            borderRadius: '12px',
                            fontWeight: '800'
                          }}>
                            {practiceFeedback.score >= 8 ? '🌟 Excellent' : practiceFeedback.score >= 5 ? '👍 Good Effort' : '⚠️ Needs Improvement'}
                          </span>
                        </div>
                        <p style={{
                          margin: '0 0 10px 0',
                          fontSize: '14px',
                          color: practiceFeedback.score >= 8 ? '#166534' : practiceFeedback.score >= 5 ? '#1e3a8a' : '#7f1d1d',
                          fontWeight: '600'
                        }}>
                          {practiceFeedback.feedbackMsg}
                        </p>
                        {practiceFeedback.keywordsFound && practiceFeedback.keywordsFound.length > 0 && (
                          <div style={{ fontSize: '12px', color: '#15803d', marginBottom: '6px' }}>
                            Key Terms Matched: <strong>{practiceFeedback.keywordsFound.join(', ')}</strong>
                          </div>
                        )}
                        {practiceFeedback.expectedAns && (
                          <div style={{ fontSize: '13px', background: '#ffffff', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e2e8f0', color: '#334155' }}>
                            💡 <strong>Teacher's Expected Reference Answer:</strong> {practiceFeedback.expectedAns}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Study Materials Cards List */}
              <div style={{ display: 'grid', gap: '16px' }}>
                {filteredStudyMaterials
                  .filter(m => !studyQuery || m.title.toLowerCase().includes(studyQuery.toLowerCase()) || (m.subject && m.subject.toLowerCase().includes(studyQuery.toLowerCase())))
                  .map(mat => (
                    <div key={mat.id} style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                      <div style={{ flex: 1, minWidth: '280px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '11px', background: '#e0f2fe', color: '#0284c7', padding: '3px 10px', borderRadius: '8px', fontWeight: '800' }}>
                            {mat.type || 'Audio Lesson'}
                          </span>
                          {mat.subject && (
                            <span style={{ fontSize: '11px', background: '#f1f5f9', color: '#475569', padding: '3px 10px', borderRadius: '8px', fontWeight: '700' }}>
                              {mat.subject}
                            </span>
                          )}
                          {(mat.publishedBy || mat.teacherName) && (
                            <span style={{ fontSize: '11px', background: '#f0fdf4', color: '#15803d', padding: '3px 10px', borderRadius: '8px', fontWeight: '800', border: '1px solid #bbf7d0', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              👨‍🏫 Published by: {mat.publishedBy || `Prof. ${mat.teacherName}`}
                            </span>
                          )}
                        </div>
                        <h3 style={{ fontSize: '18px', color: '#0f172a', margin: '0 0 6px 0', fontWeight: '800' }}>{mat.title}</h3>
                        <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>
                          {mat.detail || mat.textContent}
                        </p>
                      </div>

                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            const teacherNote = (mat.publishedBy || mat.teacherName) ? `Published by ${mat.publishedBy || `Prof. ${mat.teacherName}`}. ` : '';
                            speakText(`${mat.title}. ${teacherNote}${mat.textContent || mat.detail}`);
                          }}
                          style={{ background: '#e0f2fe', color: '#0284c7', border: '1px solid #bae6fd', padding: '10px 18px', borderRadius: '10px', fontWeight: '800', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                          <Volume2 size={16} /> Listen Lesson
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSpeakQuestionAnswerExplanation(mat);
                          }}
                          style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', padding: '10px 18px', borderRadius: '10px', fontWeight: '800', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                          <Volume2 size={16} /> Listen Answer & Explanation
                        </button>
                        <button 
                          onClick={() => {
                            handleSpeakQuestionAnswerExplanation(mat);
                          }}
                          style={{ background: '#9333ea', color: '#ffffff', border: 'none', padding: '10px 18px', borderRadius: '10px', fontWeight: '800', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                          <Sparkles size={16} /> Practice with Voice AI
                        </button>
{(() => {
                          const studentEmail = (student.email || studentProfile.email || '').toLowerCase().trim();
                          const sub = (studyTestResultsList || []).find(s => 
                            s && (s.studentEmail === studentEmail || s.studentName === student.name) && 
                            (s.materialTitle === mat.title || s.testId === mat.id)
                          );
                          if (!sub) {
                            return (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStartLessonTest(mat);
                                }}
                                style={{ background: '#16a34a', color: '#ffffff', border: 'none', padding: '10px 18px', borderRadius: '10px', fontWeight: '800', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                              >
                                <CheckSquare size={16} /> 📝 Take Lesson Test
                              </button>
                            );
                          }
                          if (sub.evaluated) {
                            return (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStartLessonTest(mat);
                                  }}
                                  style={{ background: '#15803d', color: '#ffffff', border: 'none', padding: '10px 18px', borderRadius: '10px', fontWeight: '800', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                                >
                                  <CheckCircle size={16} /> 🟢 Teacher Evaluated: {sub.teacherScore !== null && sub.teacherScore !== undefined ? sub.teacherScore : sub.score}/10
                                </button>
                              </div>
                            );
                          }
                          return (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartLessonTest(mat);
                              }}
                              style={{ background: '#d97706', color: '#ffffff', border: 'none', padding: '10px 18px', borderRadius: '10px', fontWeight: '800', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                            >
                              ⏳ Test Submitted (Pending Evaluation)
                            </button>
                          );
                        })()}
                      </div>
                    </div>
                  ))}
                {filteredStudyMaterials.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '40px', background: '#ffffff', borderRadius: '16px', color: '#64748b' }}>
                    No study materials available for {activeSubject} at the moment.
                  </div>
                )}
              </div>

              {/* Study Material Lesson Test Active Modal Card */}
              {activeLessonTest && (
                <div 
                  onClick={(e) => handleStartLessonTestDictation(e)}
                  style={{ background: '#f0fdf4', border: '2px solid #22c55e', borderRadius: '20px', padding: '28px', boxShadow: '0 8px 24px rgba(34, 197, 94, 0.15)', cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div>
                      <span style={{ fontSize: '11px', background: '#dcfce7', color: '#15803d', padding: '4px 10px', borderRadius: '8px', fontWeight: '800', textTransform: 'uppercase' }}>
                        📝 Study Material Knowledge Test
                      </span>
                      <h2 style={{ fontSize: '20px', color: '#14532d', margin: '6px 0 0 0', fontWeight: '800' }}>
                        {activeLessonTest.title}
                      </h2>
                    </div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setActiveLessonTest(null); setLessonTestFeedback(null); setLessonTestInput(''); }}
                      style={{ background: '#dcfce7', border: 'none', color: '#15803d', padding: '6px 14px', borderRadius: '8px', fontWeight: '800', cursor: 'pointer' }}
                    >
                      ✕ Close Test
                    </button>
                  </div>

                  {!lessonTestFeedback ? (
                    <div>
                      {/* Question Box */}
                      <div style={{ background: '#ffffff', border: '1px solid #bbf7d0', borderRadius: '14px', padding: '20px', marginBottom: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontSize: '12px', color: '#15803d', fontWeight: '800' }}>
                            QUESTION {lessonTestQIndex + 1} OF {activeLessonTest.questions.length}:
                          </span>
                          <button 
                            onClick={(e) => { e.stopPropagation(); speakText(`Question ${lessonTestQIndex + 1}: ${activeLessonTest.questions[lessonTestQIndex]?.text}`); }}
                            style={{ background: '#dcfce7', color: '#15803d', border: 'none', padding: '4px 12px', borderRadius: '6px', fontWeight: '700', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                          >
                            <Volume2 size={14} /> Listen Question
                          </button>
                        </div>
                        <h3 style={{ fontSize: '16px', color: '#0f172a', margin: 0, fontWeight: '700' }}>
                          {activeLessonTest.questions[lessonTestQIndex]?.text}
                        </h3>
                      </div>

                      {/* Dictation / Text Answer Box */}
                      <div style={{ marginBottom: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <label style={{ fontSize: '13px', fontWeight: '800', color: '#14532d' }}>Your Test Answer (Tap screen to speak / say DONE when finished):</label>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleStartLessonTestDictation(e); }}
                            style={{ background: '#16a34a', color: '#ffffff', border: 'none', padding: '8px 16px', borderRadius: '10px', fontWeight: '800', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                          >
                            <Mic size={14} /> Dictate Answer by Voice
                          </button>
                        </div>
                        <textarea 
                          rows={4}
                          placeholder="Tap screen or type here. Voice assistant listens continuously as long as you speak until you say DONE..."
                          value={lessonTestInput}
                          onChange={(e) => setLessonTestInput(e.target.value)}
                          onClick={(e) => { e.stopPropagation(); handleStartLessonTestDictation(e); }}
                          style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #86efac', fontSize: '14px', boxSizing: 'border-box' }}
                        />
                      </div>

                      <div style={{ display: 'flex', gap: '12px' }}>
                        <button 
                          onClick={handleSaveLessonTestNext}
                          style={{ background: '#16a34a', color: '#ffffff', border: 'none', padding: '14px 28px', borderRadius: '12px', fontWeight: '800', fontSize: '15px', cursor: 'pointer', flex: 1 }}
                        >
                          {lessonTestQIndex < activeLessonTest.questions.length - 1 ? 'Save & Next Question →' : 'Submit Lesson Test ✨'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Test Completion / Evaluation View */
                    <div style={{ background: '#ffffff', border: lessonTestFeedback.evaluated ? '2px solid #22c55e' : '2px solid #f59e0b', padding: '24px', borderRadius: '16px' }}>
                      {lessonTestFeedback.evaluated ? (
                        /* Evaluated by Teacher View */
                        <div>
                          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                            <CheckCircle size={48} color="#22c55e" style={{ marginBottom: '8px' }} />
                            <h3 style={{ margin: 0, fontSize: '20px', color: '#14532d', fontWeight: '800' }}>
                              Test Evaluated by Teacher!
                            </h3>
                            <p style={{ color: '#166534', fontSize: '13px', margin: '4px 0 0 0' }}>
                              Evaluated by <b>{lessonTestFeedback.evaluatedBy || 'Teacher'}</b> on {lessonTestFeedback.date}
                            </p>
                          </div>

                          <div style={{ background: '#f0fdf4', padding: '16px', borderRadius: '12px', border: '1px solid #bbf7d0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <div>
                              <strong style={{ fontSize: '18px', color: '#15803d' }}>Score: {lessonTestFeedback.teacherScore !== null && lessonTestFeedback.teacherScore !== undefined ? lessonTestFeedback.teacherScore : lessonTestFeedback.score} / {lessonTestFeedback.total || 10}</strong>
                              <div style={{ fontSize: '13px', color: '#166534', marginTop: '2px', fontWeight: '700' }}>
                                Status: {lessonTestFeedback.gradeStatus || (lessonTestFeedback.percentage >= 50 ? 'Passed' : 'Needs Review')}
                              </div>
                            </div>
                            <span style={{ fontSize: '24px', fontWeight: '900', color: '#15803d' }}>
                              {lessonTestFeedback.percentage}%
                            </span>
                          </div>

                          {lessonTestFeedback.teacherFeedback && (
                            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px', padding: '14px 16px', marginBottom: '16px', textAlign: 'left' }}>
                              <b style={{ color: '#1e40af', fontSize: '13px', display: 'block', marginBottom: '4px' }}>💬 Teacher Feedback & Remarks:</b>
                              <p style={{ margin: 0, color: '#1e3a8a', fontSize: '13px', lineHeight: 1.5 }}>
                                "{lessonTestFeedback.teacherFeedback}"
                              </p>
                            </div>
                          )}

                          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                            <button 
                              onClick={() => {
                                const feedbackSpeech = `Your test for ${activeLessonTest.title} was evaluated by ${lessonTestFeedback.evaluatedBy || 'Teacher'}. You scored ${lessonTestFeedback.teacherScore !== null && lessonTestFeedback.teacherScore !== undefined ? lessonTestFeedback.teacherScore : lessonTestFeedback.score} out of 10, or ${lessonTestFeedback.percentage} percent. Teacher remarks: ${lessonTestFeedback.teacherFeedback || 'Good effort.'}`;
                                speakText(feedbackSpeech);
                              }}
                              style={{ flex: 1, minWidth: '160px', background: '#0284c7', color: '#ffffff', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                            >
                              <Volume2 size={16} /> 🔊 Listen Feedback
                            </button>
                            <button 
                              onClick={() => {
                                setLessonTestFeedback(null);
                                setLessonTestQIndex(0);
                                setLessonTestInput('');
                                setLessonTestAnswers({});
                              }}
                              style={{ flex: 1, minWidth: '140px', background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '12px', borderRadius: '10px', fontWeight: '800', cursor: 'pointer' }}
                            >
                              🔄 Retake Test
                            </button>
                            <button 
                              onClick={() => { setActiveLessonTest(null); setLessonTestFeedback(null); }}
                              style={{ flex: 1, minWidth: '160px', background: '#16a34a', color: '#ffffff', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: '800', cursor: 'pointer' }}
                            >
                              Return to Study Materials
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* Pending Teacher Evaluation View */
                        <div>
                          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#fef3c7', display: 'grid', placeItems: 'center', margin: '0 auto 10px auto', fontSize: '28px' }}>
                              ⏳
                            </div>
                            <h3 style={{ margin: 0, fontSize: '20px', color: '#92400e', fontWeight: '800' }}>
                              Test Submitted to Teacher!
                            </h3>
                            <p style={{ color: '#b45309', fontSize: '14px', margin: '6px 0 0 0', fontWeight: '600' }}>
                              Status: <strong>Pending Teacher Evaluation</strong>
                            </p>
                          </div>

                          <div style={{ background: '#fffbeb', padding: '16px', borderRadius: '12px', border: '1px solid #fde68a', marginBottom: '16px', textAlign: 'left' }}>
                            <p style={{ margin: 0, fontSize: '13px', color: '#92400e', lineHeight: 1.6 }}>
                              Your test answers for <b>{activeLessonTest.title}</b> have been submitted to your teacher's dashboard. 
                              Your teacher will review each answer, evaluate your performance, and assign marks and audio feedback. 
                              Your score will be published right here once evaluated.
                            </p>
                            <div style={{ marginTop: '10px', fontSize: '12px', color: '#b45309' }}>
                              📅 Submitted on: <b>{lessonTestFeedback.date}</b> • Questions: <b>{lessonTestFeedback.answersList ? lessonTestFeedback.answersList.length : activeLessonTest.questions.length}</b>
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                            <button 
                              onClick={() => {
                                setLessonTestFeedback(null);
                                setLessonTestQIndex(0);
                                setLessonTestInput('');
                                setLessonTestAnswers({});
                              }}
                              style={{ flex: 1, minWidth: '160px', background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '12px', borderRadius: '10px', fontWeight: '800', cursor: 'pointer' }}
                            >
                              🔄 Retake / Submit Again
                            </button>
                            <button 
                              onClick={() => { setActiveLessonTest(null); setLessonTestFeedback(null); }}
                              style={{ flex: 1, minWidth: '160px', background: '#d97706', color: '#ffffff', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: '800', cursor: 'pointer' }}
                            >
                              Return to Study Materials
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 5.5: 🏆 ACCESSIBLE VOICE CERTIFICATES */}
          {activeTab === 'Certificates' && (() => {
            const studentCertificates = (filteredResults || []).map((r, idx) => {
              const totalMarks = r.total || 100;
              const scoreVal = r.score || 0;
              const pct = Math.round((scoreVal / totalMarks) * 100);

              let grade = 'Pass';
              if (pct >= 90) grade = 'Grade A+ (Distinction)';
              else if (pct >= 80) grade = 'Grade A (First Class)';
              else if (pct >= 70) grade = 'Grade B+ (Merit)';
              else if (pct >= 60) grade = 'Grade B (Pass)';
              else grade = 'Pass';

              const cleanSubject = String(r.subject || 'General').toUpperCase().replace(/[^A-Z]/g, '');
              const subCode = cleanSubject.length >= 2 ? cleanSubject.substring(0, 3) : 'EXAM';
              const yearStr = r.date ? (new Date(r.date).getFullYear() || 2026) : 2026;
              const idSuffix = String(r.id || idx + 1).replace(/\D/g, '').slice(-4) || `${1000 + idx}`;
              const credId = `CERT-${yearStr}-${subCode}-${idSuffix}`;

              // Determine registered evaluator teacher or invigilator name
              let rawEvaluator = (r.evaluatedBy || r.teacherName || r.teacher || r.invigilator || '').trim();
              if (rawEvaluator.toLowerCase() === 'prof. sharma' || rawEvaluator.toLowerCase() === 'sharma') {
                rawEvaluator = '';
              }

              // 1. If not on result, lookup from matching exam in exams or shared_exams
              if (!rawEvaluator) {
                try {
                  const allExams = [
                    ...(exams || []),
                    ...(JSON.parse(localStorage.getItem('shared_exams') || '[]'))
                  ];
                  const matchedExam = allExams.find(e => 
                    (r.examId && String(e.id) === String(r.examId)) ||
                    (r.examName && e.title && e.title.toLowerCase().trim() === r.examName.toLowerCase().trim()) ||
                    (r.subject && e.subject && isSubjectMatching(e.subject, r.subject))
                  );
                  if (matchedExam) {
                    rawEvaluator = (matchedExam.teacherName || matchedExam.teacher || matchedExam.creatorName || matchedExam.invigilator || '').trim();
                    if (rawEvaluator.toLowerCase() === 'prof. sharma' || rawEvaluator.toLowerCase() === 'sharma') {
                      rawEvaluator = '';
                    }
                  }
                } catch (e) {}
              }

              // 2. If still empty, lookup teacher for this subject from logged_in_users
              if (!rawEvaluator) {
                try {
                  const loggedMap = JSON.parse(localStorage.getItem('logged_in_users') || '{}');
                  const teachersList = Object.values(loggedMap).filter(u => u.role === 'teacher' && u.name);
                  const subjTeacher = teachersList.find(t => isSubjectMatching(t.subject, r.subject)) || teachersList[0];
                  if (subjTeacher && subjTeacher.name) {
                    rawEvaluator = subjTeacher.name;
                  }
                } catch (e) {}
              }

              // 3. If still not found, check shared_teachers_list
              if (!rawEvaluator) {
                try {
                  const sharedTeachers = JSON.parse(localStorage.getItem('shared_teachers_list') || '[]');
                  const subjTeacher = sharedTeachers.find(t => isSubjectMatching(t.subject, r.subject)) || sharedTeachers[0];
                  if (subjTeacher && (subjTeacher.name || subjTeacher.fullName)) {
                    rawEvaluator = subjTeacher.name || subjTeacher.fullName;
                  }
                } catch (e) {}
              }

              let evaluatorDisplayName = '';
              let evaluatorCleanName = '';
              if (rawEvaluator) {
                evaluatorCleanName = rawEvaluator.replace(/^Prof\.?\s*/i, '').replace(/^Dr\.?\s*/i, '').trim();
                evaluatorDisplayName = `Prof. ${evaluatorCleanName} (Exam Invigilator & Evaluator)`;
              } else {
                evaluatorCleanName = 'Department Faculty Board';
                evaluatorDisplayName = 'Department Faculty Board (Exam Invigilator & Evaluator)';
              }

              return {
                id: `cert-dynamic-${r.id || idx}`,
                title: `Certificate of Academic Excellence in ${r.examName || r.subject || 'Assessment'}`,
                course: `${r.subject || 'General'} — ${r.examName || 'Theory Assessment'}`,
                evaluatorName: evaluatorCleanName,
                issuedBy: evaluatorDisplayName,
                date: r.date || 'Recent Exam',
                score: `${pct}% (${scoreVal}/${totalMarks})`,
                grade: grade,
                credId: credId,
                description: `Awarded to ${student.name} for successfully writing and completing the ${r.examName || 'Assessment'}. Evaluated, graded, and certified by ${evaluatorDisplayName}, achieving an official score of ${scoreVal}/${totalMarks} (${pct}%).`
              };
            });

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div style={{ background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)', padding: '28px', borderRadius: '20px', color: '#ffffff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                      <span style={{ fontSize: '12px', background: 'rgba(255,255,255,0.2)', padding: '4px 12px', borderRadius: '12px', fontWeight: '800' }}>
                        🏆 OFFICIAL VOICE CREDENTIALS & AUDIO CERTIFICATES
                      </span>
                      <h1 style={{ margin: '12px 0 8px 0', fontSize: '26px', fontWeight: '900' }}>Voice-Verified Certificates of Excellence</h1>
                      <p style={{ margin: 0, fontSize: '14px', color: '#fef3c7', lineHeight: 1.5 }}>
                        Official certificates of distinction issued automatically for your completed exams. Features accessible Text-to-Speech audio narration, high contrast display, and official verification hash.
                      </p>
                    </div>
                    <button 
                      onClick={() => speakText(`Voice Certificates Section. You have ${studentCertificates.length} official certificates of achievement from completed exams. ${studentCertificates.length > 0 ? 'Click Listen Audio Certificate on any certificate to hear it read aloud.' : 'Complete and submit an exam in My Exams to earn your official certificate.'}`)}
                      style={{ background: '#ffffff', color: '#b45309', border: 'none', padding: '10px 18px', borderRadius: '12px', fontWeight: '800', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Volume2 size={16} /> Listen Section Overview
                    </button>
                  </div>
                </div>

                {/* Certificates Cards Grid or Empty State */}
                {studentCertificates.length === 0 ? (
                  <div style={{ background: '#ffffff', border: '2px dashed #f59e0b', borderRadius: '20px', padding: '48px 24px', textAlign: 'center' }}>
                    <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: '#fef3c7', display: 'grid', placeItems: 'center', margin: '0 auto 16px auto', border: '1px solid #fde68a' }}>
                      <Award size={36} color="#d97706" />
                    </div>
                    <h3 style={{ fontSize: '20px', color: '#78350f', margin: '0 0 8px 0', fontWeight: '800' }}>
                      No Exam Certificates Earned Yet
                    </h3>
                    <p style={{ fontSize: '14px', color: '#92400e', maxWidth: '560px', margin: '0 auto 20px auto', lineHeight: 1.6 }}>
                      Certificates are awarded automatically once you write and submit an official exam. Head over to <strong>My Exams</strong> or <strong>AI Exam Assistant</strong> to begin your assessment.
                    </p>
                    <button 
                      onClick={() => { setActiveTab('My Exams'); speakText("Switched to My Exams. Choose an active exam to begin."); }}
                      style={{ background: '#d97706', color: '#ffffff', border: 'none', padding: '12px 24px', borderRadius: '12px', fontWeight: '800', fontSize: '14px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                    >
                      <BookOpen size={16} /> Go to My Exams & Write Exam
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
                    {studentCertificates.map(cert => (
                      <div key={cert.id} style={{ background: '#ffffff', border: '2px solid #f59e0b', borderRadius: '20px', padding: '24px', position: 'relative', boxShadow: '0 8px 24px rgba(245, 158, 11, 0.12)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#fef3c7', display: 'grid', placeItems: 'center', border: '1px solid #fde68a' }}>
                            <Award size={28} color="#d97706" />
                          </div>
                          <div>
                            <span style={{ fontSize: '11px', color: '#b45309', fontWeight: '800', letterSpacing: '0.5px', textTransform: 'uppercase' }}>OFFICIAL VOICE CREDENTIAL</span>
                            <h3 style={{ fontSize: '16px', color: '#78350f', margin: 0, fontWeight: '800' }}>{cert.title}</h3>
                          </div>
                        </div>

                        <div style={{ background: '#fffbeb', padding: '14px', borderRadius: '12px', border: '1px solid #fde68a', marginBottom: '16px' }}>
                          <div style={{ fontSize: '13px', color: '#92400e', marginBottom: '4px' }}><strong>Student Name:</strong> {student.name}</div>
                          <div style={{ fontSize: '13px', color: '#92400e', marginBottom: '4px' }}><strong>Course / Subject:</strong> {cert.course}</div>
                          <div style={{ fontSize: '13px', color: '#92400e', marginBottom: '4px' }}><strong>Score & Grade:</strong> {cert.score} — <span style={{ color: '#15803d', fontWeight: '800' }}>{cert.grade}</span></div>
                          <div style={{ fontSize: '13px', color: '#92400e', marginBottom: '4px' }}><strong>Evaluated By (Teacher / Invigilator):</strong> <span style={{ fontWeight: '800', color: '#78350f' }}>{cert.evaluatorName || cert.issuedBy}</span></div>
                          <div style={{ fontSize: '12px', color: '#b45309' }}><strong>Official Certification:</strong> {cert.issuedBy} ({cert.date})</div>
                        </div>

                        <p style={{ fontSize: '13px', color: '#475569', margin: '0 0 16px 0', lineHeight: 1.5, fontStyle: 'italic' }}>
                          "{cert.description}"
                        </p>

                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <button 
                            onClick={() => speakText(`Certificate of Academic Excellence awarded to ${student.name} for ${cert.course}. Score ${cert.score}, ${cert.grade}. Evaluated by Teacher ${cert.evaluatorName || 'Course Instructor'}. Certified by ${cert.issuedBy} on ${cert.date}. ${cert.description}`)}
                            style={{ flex: 1, background: '#d97706', color: '#ffffff', border: 'none', padding: '10px 14px', borderRadius: '10px', fontWeight: '800', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                          >
                            <Volume2 size={16} /> 🔊 Listen Audio Certificate
                          </button>
                          <button 
                            onClick={() => window.print()}
                            style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', padding: '10px 14px', borderRadius: '10px', fontWeight: '800', fontSize: '12px', cursor: 'pointer' }}
                          >
                            🖨️ Print PDF
                          </button>
                        </div>

                        <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px dashed #fde68a', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#b45309' }}>
                          <span>ID: {cert.credId}</span>
                          <span style={{ color: '#166534', fontWeight: '800' }}>✓ Verified Voice Signature</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* TAB 6: 🔊 VOICE ASSISTANT */}
          {activeTab === 'Voice Assistant' && (
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '20px', padding: '32px', textAlign: 'center' }}>
              <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: '#e0f2fe', display: 'grid', placeItems: 'center', margin: '0 auto 16px auto', border: '2px solid #bae6fd' }}>
                <Mic size={40} color="#0284c7" />
              </div>
              <h1 style={{ margin: 0, fontSize: '24px', color: '#0369a1', fontWeight: '800' }}>Voice & Typed Assistant Command Center</h1>
              <p style={{ color: '#64748b', margin: '8px 0 24px 0', fontSize: '14px' }}>
                100% accessible navigation and exam controls. Speak commands using your microphone or type them directly into the command bar.
              </p>
              
              {/* Voice Enable / Disable Master Action */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={toggleVoiceAssistantEnabled}
                  style={{
                    background: isVoiceAssistantEnabled ? '#ecfdf5' : '#fef2f2',
                    color: isVoiceAssistantEnabled ? '#047857' : '#b91c1c',
                    border: isVoiceAssistantEnabled ? '2px solid #a7f3d0' : '2px solid #fecaca',
                    padding: '12px 28px',
                    borderRadius: '12px',
                    fontWeight: '800',
                    fontSize: '14px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '10px',
                    boxShadow: isVoiceAssistantEnabled ? '0 4px 12px rgba(16, 185, 129, 0.15)' : '0 4px 12px rgba(239, 68, 68, 0.15)'
                  }}
                >
                  {isVoiceAssistantEnabled ? (
                    <>
                      <Volume2 size={20} color="#059669" />
                      <span>🟢 Voice Assistant: ENABLED (Click to Disable)</span>
                    </>
                  ) : (
                    <>
                      <VolumeX size={20} color="#dc2626" />
                      <span>🔴 Voice Assistant: DISABLED (Click to Enable)</span>
                    </>
                  )}
                </button>

                <button 
                  onClick={triggerVoiceCommand} 
                  disabled={!isVoiceAssistantEnabled}
                  style={{ background: isVoiceAssistantEnabled ? '#0284c7' : '#94a3b8', color: '#fff', border: 'none', padding: '12px 28px', borderRadius: '12px', fontWeight: '800', fontSize: '14px', cursor: isVoiceAssistantEnabled ? 'pointer' : 'not-allowed', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                >
                  <Mic size={18} /> 🎙 Tap to Speak Command
                </button>

                <button 
                  onClick={speakDashboardFeatures} 
                  style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', padding: '12px 24px', borderRadius: '12px', fontWeight: '800', fontSize: '14px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                >
                  <Volume2 size={18} /> 📢 Read All 11 Features Aloud
                </button>

                <button 
                  onClick={() => setIsElevenLabsModalOpen(true)} 
                  style={{ background: '#f0f9ff', color: '#0284c7', border: '1.5px solid #38bdf8', padding: '12px 24px', borderRadius: '12px', fontWeight: '800', fontSize: '14px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                >
                  ⚡ ElevenLabs Voice Settings
                </button>
              </div>

              {/* Typed Command Interactive Box */}
              <div style={{ maxWidth: '680px', margin: '0 auto 32px auto', background: '#f8fafc', padding: '20px', borderRadius: '16px', border: '1.5px solid #cbd5e1', textAlign: 'left' }}>
                <b style={{ fontSize: '14px', color: '#0f172a', display: 'block', marginBottom: '8px' }}>⌨️ Test Typed Command Input:</b>
                <form 
                  onSubmit={handleExecuteTypedCommand}
                  style={{ display: 'flex', gap: '8px' }}
                >
                  <input 
                    type="text"
                    value={typedCommandInput}
                    onChange={(e) => setTypedCommandInput(e.target.value)}
                    placeholder="Type command here (e.g. 'open my exams', 'start viva', 'read profile')..."
                    style={{ flex: 1, padding: '12px 16px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px', fontWeight: '600' }}
                  />
                  <button 
                    type="submit"
                    style={{ background: '#0f172a', color: '#ffffff', border: 'none', padding: '12px 24px', borderRadius: '10px', fontWeight: '800', fontSize: '14px', cursor: 'pointer' }}
                  >
                    ⚡ Execute
                  </button>
                </form>
              </div>

              {/* Supported Voice & Typed Commands Cheatsheet */}
              <div style={{ maxWidth: '900px', margin: '0 auto', textAlign: 'left' }}>
                <h3 style={{ fontSize: '18px', color: '#0369a1', margin: '0 0 16px 0', fontWeight: '800' }}>
                  📋 Complete Voice & Typed Commands Cheatsheet
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                  <div style={{ background: '#eff6ff', padding: '16px', borderRadius: '12px', border: '1px solid #bfdbfe' }}>
                    <b style={{ color: '#1d4ed8', fontSize: '14px', display: 'block', marginBottom: '6px' }}>🧭 Navigation Commands</b>
                    <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: '#1e3a8a', lineHeight: 1.6 }}>
                      <li><code>"dashboard"</code> or <code>"home"</code></li>
                      <li><code>"my exams"</code> or <code>"show exams"</code></li>
                      <li><code>"oral viva"</code> or <code>"viva simulator"</code></li>
                      <li><code>"certificates"</code> or <code>"awards"</code></li>
                      <li><code>"study materials"</code> or <code>"audio lessons"</code></li>
                      <li><code>"notifications"</code> or <code>"announcements"</code></li>
                      <li><code>"profile"</code> or <code>"settings"</code></li>
                    </ul>
                  </div>

                  <div style={{ background: '#f0fdf4', padding: '16px', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
                    <b style={{ color: '#15803d', fontSize: '14px', display: 'block', marginBottom: '6px' }}>📝 Exam & Viva Commands</b>
                    <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: '#14532d', lineHeight: 1.6 }}>
                      <li><code>"start exam"</code> / <code>"take exam"</code></li>
                      <li><code>"option a"</code>, <code>"option b"</code>, <code>"option c"</code>, <code>"option d"</code></li>
                      <li><code>"confirm"</code> / <code>"change answer"</code></li>
                      <li><code>"read question"</code> / <code>"repeat"</code></li>
                      <li><code>"time"</code> or <code>"remaining"</code></li>
                      <li><code>"submit exam"</code></li>
                      <li><code>"evaluate viva"</code></li>
                    </ul>
                  </div>

                  <div style={{ background: '#faf5ff', padding: '16px', borderRadius: '12px', border: '1px solid #e9d5ff' }}>
                    <b style={{ color: '#7e22ce', fontSize: '14px', display: 'block', marginBottom: '6px' }}>🎓 Academic & System</b>
                    <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: '#581c87', lineHeight: 1.6 }}>
                      <li><code>"all features"</code> / <code>"help"</code></li>
                      <li><code>"read profile"</code> (speaks details)</li>
                      <li><code>"switch to science"</code> / <code>"kannada"</code> / <code>"math"</code></li>
                      <li><code>"emergency"</code> or <code>"sos"</code></li>
                      <li><code>"speed up"</code> / <code>"slow down"</code></li>
                      <li><code>"high contrast"</code></li>
                      <li><code>"logout"</code> / <code>"sign out"</code></li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: ♿ ACCESSIBILITY SETTINGS */}
          {activeTab === 'Accessibility Settings' && (
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '20px', padding: '32px' }}>
              <h1 style={{ margin: '0 0 20px 0', fontSize: '22px', color: '#0369a1', fontWeight: '800' }}>♿ Accessibility Settings</h1>
              <div style={{ display: 'grid', gap: '20px' }}>
                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: isVoiceAssistantEnabled ? '#ecfdf5' : '#fef2f2', borderRadius: '12px', border: isVoiceAssistantEnabled ? '2px solid #a7f3d0' : '2px solid #fecaca' }}>
                  <div>
                    <b style={{ display: 'block', fontSize: '15px', color: isVoiceAssistantEnabled ? '#047857' : '#b91c1c' }}>
                      Master Voice Assistant (ElevenLabs AI Voice & Speech Recognition)
                    </b>
                    <small style={{ color: '#64748b' }}>Toggle entire voice assistant system on or off across student dashboard and exams.</small>
                  </div>
                  <button
                    type="button"
                    onClick={toggleVoiceAssistantEnabled}
                    style={{
                      background: isVoiceAssistantEnabled ? '#059669' : '#dc2626',
                      color: '#ffffff',
                      border: 'none',
                      padding: '8px 18px',
                      borderRadius: '8px',
                      fontWeight: '800',
                      fontSize: '13px',
                      cursor: 'pointer'
                    }}
                  >
                    {isVoiceAssistantEnabled ? 'Enabled ✓' : 'Disabled ✗'}
                  </button>
                </label>

                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <div>
                    <b style={{ display: 'block', fontSize: '14px', color: '#0f172a' }}>Text-to-Speech Narration</b>
                    <small style={{ color: '#64748b' }}>Read questions and dashboard text aloud.</small>
                  </div>
                  <input type="checkbox" checked={accessibility.ttsEnabled} onChange={e => setAccessibility({ ...accessibility, ttsEnabled: e.target.checked })} style={{ width: '20px', height: '20px' }} />
                </label>

                {/* Dedicated ElevenLabs AI Voice Assistant Engine Controls */}
                <div style={{ padding: '24px', background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)', borderRadius: '16px', border: '2px solid #38bdf8' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <b style={{ display: 'block', fontSize: '16px', color: '#0369a1' }}>⚡ ElevenLabs AI Voice Assistant Engine Controls</b>
                      <small style={{ color: '#475569' }}>High-fidelity, ultra-realistic AI voice narration powered exclusively by ElevenLabs.</small>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsElevenLabsModalOpen(true)}
                      style={{ background: '#0284c7', color: '#ffffff', border: 'none', padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      ⚙️ API Key & Settings
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '18px' }}>
                    {/* ElevenLabs Voice Character Selection */}
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '800', color: '#0369a1', marginBottom: '6px' }}>
                        ElevenLabs Voice Character
                      </label>
                      <select 
                        value={localStorage.getItem('elevenlabs_voice_id') || '21m00Tcm4TlvDq8ikWAM'} 
                        onChange={e => {
                          saveElevenLabsConfig({ voiceId: e.target.value });
                          speakText(`Selected voice character set to ${ELEVENLABS_VOICES.find(v => v.id === e.target.value)?.name || 'ElevenLabs voice'}.`);
                        }}
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1.5px solid #38bdf8', fontSize: '13px', background: '#ffffff', color: '#0f172a', fontWeight: '700' }}
                      >
                        {ELEVENLABS_VOICES.map((v) => (
                          <option key={v.id} value={v.id}>
                            🎙️ {v.name} ({v.gender}) - {v.description}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Speech Speed / Rate Slider */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <label style={{ fontSize: '13px', fontWeight: '800', color: '#0369a1' }}>ElevenLabs Speech Speed</label>
                        <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#0284c7' }}>{Math.round((accessibility.speechRate || 0.85) * 100)}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="0.65" 
                        max="1.35" 
                        step="0.05" 
                        value={accessibility.speechRate || 0.85} 
                        onChange={e => setAccessibility({ ...accessibility, speechRate: parseFloat(e.target.value) })}
                        style={{ width: '100%' }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b' }}>
                        <span>Clear & Calm (0.65x)</span>
                        <span>Normal (0.85x)</span>
                        <span>Fast (1.35x)</span>
                      </div>
                    </div>
                  </div>

                  {/* Test & Action Buttons */}
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button 
                      type="button"
                      onClick={() => {
                        speakText(
                          `ElevenLabs AI Voice Assistant test. Speech speed is set to ${Math.round((accessibility.speechRate || 0.85) * 100)} percent. Rachel is ready to guide you through all exams and lessons.`
                        );
                      }}
                      style={{ background: '#0284c7', color: '#ffffff', border: 'none', padding: '10px 20px', borderRadius: '10px', fontWeight: '800', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Volume2 size={16} /> 🎧 Test ElevenLabs AI Audio
                    </button>
                    <button 
                      type="button"
                      onClick={cancelSpeech}
                      style={{ background: '#ffffff', color: '#475569', border: '1px solid #cbd5e1', padding: '10px 18px', borderRadius: '10px', fontWeight: '800', fontSize: '13px', cursor: 'pointer' }}
                    >
                      ⏹ Stop Speech
                    </button>
                    <button 
                      type="button"
                      onClick={() => setIsElevenLabsModalOpen(true)}
                      style={{ background: '#ffffff', color: '#0369a1', border: '1.5px solid #38bdf8', padding: '10px 18px', borderRadius: '10px', fontWeight: '800', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      ⚡ ElevenLabs API Settings
                    </button>
                  </div>
                </div>

                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <div>
                    <b style={{ display: 'block', fontSize: '14px', color: '#0f172a' }}>High Contrast Mode</b>
                    <small style={{ color: '#64748b' }}>Use high contrast colors for visual clarity.</small>
                  </div>
                  <input type="checkbox" checked={accessibility.highContrast} onChange={e => setAccessibility({ ...accessibility, highContrast: e.target.checked })} style={{ width: '20px', height: '20px' }} />
                </label>

                {/* 🔤 Interactive Audio Braille Simulator */}
                <div style={{ padding: '20px', background: '#f0f9ff', borderRadius: '14px', border: '1px solid #bae6fd' }}>
                  <b style={{ display: 'block', fontSize: '15px', color: '#0369a1', marginBottom: '6px' }}>🔤 Interactive 6-Dot Audio Braille Simulator</b>
                  <small style={{ color: '#0284c7', display: 'block', marginBottom: '16px' }}>Tap 6-dot cells to test Braille touch combinations with speech pronunciation feedback.</small>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 60px)', gap: '12px', justifyContent: 'center', margin: '0 auto 16px auto' }}>
                    {[0, 1, 2, 3, 4, 5].map(idx => (
                      <button 
                        key={idx}
                        onClick={() => toggleBrailleDot(idx)}
                        style={{ width: '60px', height: '60px', borderRadius: '50%', border: brailleDots[idx] ? '3px solid #0284c7' : '2px dashed #cbd5e1', background: brailleDots[idx] ? '#0284c7' : '#ffffff', color: brailleDots[idx] ? '#ffffff' : '#64748b', fontWeight: '800', fontSize: '16px', cursor: 'pointer', display: 'grid', placeItems: 'center' }}
                      >
                        Dot {idx + 1}
                      </button>
                    ))}
                  </div>

                  <button 
                    onClick={() => setBrailleDots([false, false, false, false, false, false])}
                    style={{ display: 'block', margin: '0 auto', background: '#ffffff', border: '1px solid #cbd5e1', padding: '6px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: '800', cursor: 'pointer', color: '#0f172a' }}
                  >
                    Clear Cell Selection
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 8: 16. 🔔 NOTIFICATIONS CENTER */}
          {activeTab === 'Notifications' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Header Banner */}
              <div style={{ background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', padding: '28px', borderRadius: '20px', color: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <span style={{ fontSize: '12px', background: 'rgba(255,255,255,0.2)', padding: '4px 12px', borderRadius: '12px', fontWeight: '800' }}>
                    16. 🔔 NOTIFICATIONS CENTER
                  </span>
                  <h1 style={{ margin: '12px 0 8px 0', fontSize: '26px', fontWeight: '900' }}>Real-Time Student Alerts</h1>
                  <p style={{ margin: 0, fontSize: '14px', color: '#e0f2fe', lineHeight: 1.5 }}>
                    Receive instant push alerts for upcoming exams, starting countdowns, exam reminders, published grades, teacher broadcasts, and help request responses.
                  </p>
                </div>
                <button 
                  onClick={() => {
                    const allText = announcements.map(a => `${a.title}. ${a.detail}`).join(' Next notification: ');
                    speakText(`Reading all ${announcements.length} notifications: ${allText}`);
                  }}
                  onMouseEnter={() => speakHover("Read All Notifications Aloud button")}
                  style={{ background: '#ffffff', color: '#0369a1', border: 'none', padding: '12px 20px', borderRadius: '12px', fontWeight: '800', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
                >
                  <Volume2 size={18} /> 🔊 Read All Notifications Aloud
                </button>
              </div>

              {/* Notification Types Category Chips */}
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '16px 20px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: '800', color: '#64748b', marginRight: '8px' }}>NOTIFICATION TYPES:</span>
                {[
                  { label: '🔔 Exam Starting', bg: '#fef3c7', color: '#b45309' },
                  { label: '🎙️ Oral Viva', bg: '#dcfce7', color: '#15803d' },
                  { label: '📝 New Exam', bg: '#e0f2fe', color: '#0369a1' },
                  { label: '⏰ Exam Reminder', bg: '#ffedd5', color: '#c2410c' },
                  { label: '📊 Result Published', bg: '#dcfce7', color: '#15803d' },
                  { label: '📢 Teacher Announcement', bg: '#f3e8ff', color: '#7e22ce' },
                  { label: '🚨 Assistance Response', bg: '#fee2e2', color: '#b91c1c' }
                ].map((type, idx) => (
                  <span 
                    key={idx} 
                    onMouseEnter={() => speakHover(`${type.label} notification category`)}
                    style={{ background: type.bg, color: type.color, padding: '4px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: '800', cursor: 'default' }}
                  >
                    {type.label}
                  </span>
                ))}
              </div>

              {/* Notifications Cards Grid */}
              <div style={{ display: 'grid', gap: '14px' }}>
                {announcements.length > 0 ? (
                  announcements.map((ann, idx) => (
                    <div 
                      key={ann.id || idx} 
                      onMouseEnter={() => speakHover(`Notification: ${ann.title}. ${ann.detail || ann.message || ''}`)}
                      style={{ 
                        background: (ann.title && ann.title.includes('starts in 30 minutes')) ? '#fffbeb' : '#ffffff', 
                        border: (ann.title && ann.title.includes('starts in 30 minutes')) ? '2px solid #f59e0b' : '1px solid #e2e8f0', 
                        borderRadius: '16px', 
                        padding: '20px', 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '12px',
                        cursor: 'pointer',
                        boxShadow: (ann.title && ann.title.includes('starts in 30 minutes')) ? '0 4px 16px rgba(245, 158, 11, 0.15)' : 'none'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', flex: 1, minWidth: '260px' }}>
                        <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#f0f9ff', display: 'grid', placeItems: 'center', fontSize: '20px', border: '1px solid #bae6fd', flexShrink: 0 }}>
                          {ann.icon || '🔔'}
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                            <b style={{ fontSize: '16px', color: '#0f172a' }}>{ann.title}</b>
                            {ann.type && (
                              <span style={{ fontSize: '11px', background: ann.type === 'Oral Viva' ? '#dcfce7' : '#e0f2fe', color: ann.type === 'Oral Viva' ? '#15803d' : '#0284c7', padding: '2px 8px', borderRadius: '6px', fontWeight: '800' }}>
                                {ann.type}
                              </span>
                            )}
                            {ann.type === 'Oral Viva' && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveTab('AI Oral Viva Simulator');
                                  speakText("Opening AI Oral Viva Simulator.");
                                }}
                                style={{ background: '#16a34a', color: '#ffffff', border: 'none', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '800', cursor: 'pointer' }}
                              >
                                🎙️ Open Viva →
                              </button>
                            )}
                          </div>
                          <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#475569', lineHeight: 1.5 }}>
                            {ann.detail || ann.message}
                          </p>
                          {ann.date && (
                            <small style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px', display: 'block' }}>
                              Received: {ann.date}
                            </small>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                          onClick={() => speakText(`Notification: ${ann.title}. ${ann.detail || ann.message || ''}`)} 
                          style={{ background: '#0284c7', color: '#ffffff', border: 'none', padding: '10px 18px', borderRadius: '10px', fontWeight: '800', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                          <Volume2 size={16} /> 🔊 Listen Audio
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '40px', textAlign: 'center', color: '#64748b' }}>
                    <Bell size={48} color="#94a3b8" style={{ marginBottom: '12px' }} />
                    <h3 style={{ margin: 0, fontSize: '16px', color: '#0f172a' }}>No Announcements</h3>
                    <p style={{ margin: '4px 0 0 0', fontSize: '13px' }}>Your teacher has not published any announcements or alerts yet.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 9: 👤 PROFILE */}
          {activeTab === 'Profile' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Profile Card Header with Profile Picture */}
              <div style={{ 
                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', 
                borderRadius: '24px', 
                padding: '36px 32px', 
                color: '#ffffff', 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                textAlign: 'center',
                boxShadow: '0 10px 30px rgba(2, 132, 199, 0.25)',
                position: 'relative'
              }}>
                
                {/* Profile Picture Frame */}
                <div style={{ position: 'relative', marginBottom: '16px' }}>
                  <div style={{ 
                    width: '140px', 
                    height: '140px', 
                    borderRadius: '50%', 
                    background: '#ffffff', 
                    border: studentProfile.profilePic ? '4px solid #22c55e' : '4px dashed #f59e0b', 
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)', 
                    overflow: 'hidden', 
                    display: 'grid', 
                    placeItems: 'center' 
                  }}>
                    {studentProfile.profilePic ? (
                      <img 
                        src={studentProfile.profilePic} 
                        alt={studentProfile.name} 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                      />
                    ) : (
                      <div style={{ 
                        width: '100%', 
                        height: '100%', 
                        background: 'linear-gradient(135deg, #0284c7 0%, #0f172a 100%)', 
                        color: '#ffffff', 
                        fontSize: '44px', 
                        fontWeight: '900', 
                        display: 'grid', 
                        placeItems: 'center' 
                      }}>
                        {studentProfile.name ? studentProfile.name.split(' ').map(n => n[0]).join('').substring(0, 2) : 'ST'}
                      </div>
                    )}
                  </div>

                  {/* Upload Photo Button Badge */}
                  <label 
                    title="Upload Profile Photo File"
                    style={{ 
                      position: 'absolute', 
                      bottom: '4px', 
                      right: '4px', 
                      background: '#38bdf8', 
                      color: '#0f172a', 
                      width: '40px', 
                      height: '40px', 
                      borderRadius: '50%', 
                      display: 'grid', 
                      placeItems: 'center', 
                      cursor: 'pointer', 
                      border: '3px solid #ffffff', 
                      boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
                      transition: 'transform 0.2s ease'
                    }}
                  >
                    <Camera size={18} />
                    <input type="file" accept="image/*" onChange={handleProfilePicUpload} style={{ display: 'none' }} />
                  </label>
                </div>

                {/* Biometric Status Pill */}
                <div style={{ marginBottom: '12px' }}>
                  {studentProfile.profilePic ? (
                    <span style={{ fontSize: '12px', background: '#dcfce7', color: '#15803d', padding: '4px 14px', borderRadius: '20px', fontWeight: '800', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e' }}></span>
                      ✓ Biometric Face Registered for Exams
                    </span>
                  ) : (
                    <span style={{ fontSize: '12px', background: '#fee2e2', color: '#b91c1c', padding: '4px 14px', borderRadius: '20px', fontWeight: '800', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444' }}></span>
                      ⚠️ No Face Photo Registered (Exams Locked)
                    </span>
                  )}
                </div>

                {/* Photo Action Buttons */}
                <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
                  <button
                    type="button"
                    onClick={handleOpenProfileSnapModal}
                    style={{ background: '#38bdf8', color: '#0f172a', border: 'none', padding: '8px 16px', borderRadius: '10px', fontWeight: '800', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 4px 10px rgba(0,0,0,0.15)' }}
                  >
                    <Camera size={16} /> 📷 Snap Photo with Webcam
                  </button>
                  <label
                    style={{ background: 'rgba(255,255,255,0.2)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.4)', padding: '8px 16px', borderRadius: '10px', fontWeight: '800', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    📁 Upload Image File
                    <input type="file" accept="image/*" onChange={handleProfilePicUpload} style={{ display: 'none' }} />
                  </label>
                </div>

                {/* Details Directly Down to Picture */}
                {Boolean(studentProfile.registerNumber) && (
                  <span style={{ 
                    background: 'rgba(255, 255, 255, 0.2)', 
                    color: '#ffffff', 
                    padding: '4px 14px', 
                    borderRadius: '20px', 
                    fontSize: '12px', 
                    fontWeight: '800', 
                    letterSpacing: '0.5px',
                    marginBottom: '6px',
                    textTransform: 'uppercase'
                  }}>
                    REGISTER NO: {studentProfile.registerNumber}
                  </span>
                )}

                <h1 style={{ margin: '4px 0 16px 0', fontSize: '28px', fontWeight: '900', color: '#ffffff' }}>
                  {studentProfile.name || (studentProfile.email ? formatSpokenName(studentProfile.email.split('@')[0]) : 'Student Profile')}
                </h1>

                {/* Action Controls */}
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
                  <button 
                    type="button"
                    onClick={startVoiceProfileWizard}
                    style={{ background: '#0284c7', color: '#ffffff', border: '2px solid #38bdf8', padding: '10px 22px', borderRadius: '12px', fontWeight: '900', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 15px rgba(2, 132, 199, 0.4)' }}
                    title="Start step-by-step interactive voice assistant to fill your profile"
                  >
                    <Mic size={16} /> 🎙️ Fill Profile by Voice
                  </button>
                  <button 
                    onClick={handleReadProfileAloud}
                    style={{ background: '#ffffff', color: '#0369a1', border: 'none', padding: '10px 20px', borderRadius: '12px', fontWeight: '800', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
                  >
                    <Volume2 size={16} /> 🔊 Read Profile Aloud
                  </button>
                  {isEditingProfile ? (
                    <button 
                      onClick={handleSaveProfile}
                      style={{ background: '#22c55e', color: '#ffffff', border: 'none', padding: '10px 20px', borderRadius: '12px', fontWeight: '800', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
                    >
                      <Save size={16} /> 💾 Save Profile
                    </button>
                  ) : (
                    <button 
                      onClick={() => { setIsEditingProfile(true); speakText("Edit profile mode activated."); }}
                      style={{ background: 'rgba(255,255,255,0.2)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.4)', padding: '10px 20px', borderRadius: '12px', fontWeight: '800', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                      ✏️ Edit Details
                    </button>
                  )}
                </div>

              </div>

              {/* WEBCAM SNAP PROFILE PHOTO MODAL */}
              {isProfileSnapModalOpen && (
                <div 
                  onClick={handleCloseProfileSnapModal}
                  style={{
                    position: 'fixed', inset: 0,
                    background: 'rgba(15, 23, 42, 0.85)',
                    backdropFilter: 'blur(10px)',
                    zIndex: 999999,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '20px'
                  }}
                >
                  <div 
                    onClick={e => e.stopPropagation()}
                    style={{
                      background: '#ffffff',
                      borderRadius: '24px',
                      maxWidth: '480px',
                      width: '100%',
                      padding: '28px',
                      textAlign: 'center',
                      boxShadow: '0 25px 50px rgba(0,0,0,0.4)',
                      border: '3px solid #0284c7'
                    }}
                  >
                    <h3 style={{ margin: '0 0 6px 0', fontSize: '20px', fontWeight: '900', color: '#0f172a' }}>
                      📷 Snap Official Profile Photo
                    </h3>
                    <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#64748b' }}>
                      Position your face inside the circle for official exam face recognition.
                    </p>

                    <div style={{
                      position: 'relative',
                      width: '100%',
                      height: '280px',
                      borderRadius: '16px',
                      overflow: 'hidden',
                      background: '#0f172a',
                      marginBottom: '18px',
                      border: '2px solid #38bdf8'
                    }}>
                      <video 
                        ref={snapVideoRef} 
                        autoPlay 
                        playsInline 
                        muted 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                      />
                      <canvas ref={snapCanvasRef} style={{ display: 'none' }} />

                      <div style={{
                        position: 'absolute',
                        top: '50%', left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: '160px', height: '200px',
                        borderRadius: '50%',
                        border: '3px dashed #38bdf8',
                        boxShadow: '0 0 15px rgba(56, 189, 248, 0.5)',
                        pointerEvents: 'none'
                      }} />
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        type="button"
                        onClick={handleCaptureProfilePhoto}
                        style={{ flex: 1, background: '#0284c7', color: '#ffffff', border: 'none', padding: '12px 20px', borderRadius: '12px', fontWeight: '800', fontSize: '14px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)' }}
                      >
                        📸 Capture & Save Photo
                      </button>
                      <button
                        type="button"
                        onClick={handleCloseProfileSnapModal}
                        style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '12px 18px', borderRadius: '12px', fontWeight: '800', fontSize: '13px', cursor: 'pointer' }}
                      >
                        ✕ Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Detailed Profile Grid Down to Picture */}
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '24px', padding: '32px', boxShadow: '0 2px 12px rgba(0,0,0,0.03)' }}>
                <h2 style={{ margin: '0 0 24px 0', fontSize: '18px', color: '#0f172a', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '2px solid #f1f5f9', paddingBottom: '12px' }}>
                  <User size={22} color="#0284c7" /> Student Profile & Contact Information
                </h2>

                {/* Voice Profile Assistant Banner */}
                <div style={{ background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)', border: '2px solid #38bdf8', borderRadius: '16px', padding: '16px 20px', marginBottom: '22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: '#0284c7', display: 'grid', placeItems: 'center', color: '#fff', fontSize: '20px', boxShadow: '0 4px 10px rgba(2, 132, 199, 0.3)' }}>
                      🎙️
                    </div>
                    <div>
                      <b style={{ color: '#0369a1', fontSize: '15px', display: 'block' }}>Step-by-Step Voice Assistant Profile Setup</b>
                      <span style={{ color: '#0c4a6e', fontSize: '13px' }}>Our voice assistant will guide you step by step to speak and fill your name and main subject.</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={startVoiceProfileWizard}
                    style={{ background: '#0284c7', color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 20px', fontWeight: '800', fontSize: '13px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)' }}
                  >
                    <Mic size={15} /> 🎙️ Fill Profile by Voice
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
                  
                  {/* 1. Register Number */}
                  <ProfileDetailCard 
                    label="REGISTER NUMBER" 
                    value={studentProfile.registerNumber} 
                    isEditing={isEditingProfile} 
                    field="registerNumber" 
                    formState={profileEditForm} 
                    setFormState={setProfileEditForm} 
                  />

                  {/* 2. Full Name */}
                  <ProfileDetailCard 
                    label="FULL NAME" 
                    value={studentProfile.name} 
                    isEditing={isEditingProfile} 
                    field="name" 
                    formState={profileEditForm} 
                    setFormState={setProfileEditForm} 
                  />

                  {/* 3. Email Address */}
                  <ProfileDetailCard 
                    label="EMAIL ADDRESS" 
                    value={studentProfile.email} 
                    isEditing={isEditingProfile} 
                    field="email" 
                    formState={profileEditForm} 
                    setFormState={setProfileEditForm} 
                    style={{ gridColumn: 'span 2' }}
                  />

                  {/* 5. Focused Main Academic Subject */}
                  <ProfileDetailCard 
                    label="FOCUSED MAIN ACADEMIC SUBJECT" 
                    style={{ gridColumn: 'span 2', background: '#f0f9ff', border: '2px solid #7dd3fc', padding: '22px' }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                        <div>
                          <b style={{ fontSize: '15px', color: '#0369a1', display: 'block' }}>
                            Select Focused Main Academic Subject
                          </b>
                          <small style={{ fontSize: '12px', color: '#64748b' }}>
                            Choose your main discipline from the menu below. All related sub-subjects are automatically covered.
                          </small>
                        </div>
                        <span style={{ 
                          background: '#0284c7', 
                          color: '#ffffff', 
                          fontSize: '12px', 
                          fontWeight: '800', 
                          padding: '6px 14px', 
                          borderRadius: '20px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 2px 8px rgba(2, 132, 199, 0.25)'
                        }}>
                          🎯 Active Main Subject: {activeSubject}
                        </span>
                      </div>

                      {/* Dropdown with only MAIN SUBJECTS */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <select
                          value={activeSubject}
                          onChange={(e) => {
                            const selected = e.target.value;
                            handleSwitchStudentSubject(selected);
                            if (isEditingProfile) {
                              setProfileEditForm(prev => ({ ...prev, interestedSubject: selected, subject: selected }));
                            }
                          }}
                          style={{
                            width: '100%',
                            padding: '11px 16px',
                            borderRadius: '10px',
                            border: '2px solid #0284c7',
                            background: '#ffffff',
                            fontSize: '14px',
                            fontWeight: '800',
                            color: '#0f172a',
                            cursor: 'pointer',
                            outline: 'none',
                            boxShadow: '0 2px 10px rgba(2, 132, 199, 0.1)'
                          }}
                          title="Select your focused main academic subject"
                        >
                          {!MAIN_SUBJECTS.includes(activeSubject) && (
                            <option value={activeSubject}>{activeSubject}</option>
                          )}
                          {MAIN_SUBJECTS.map(sub => (
                            <option key={sub} value={sub}>{sub}</option>
                          ))}
                        </select>
                      </div>

                      {/* Multiple Main Subjects Quick Selection Badges */}
                      <div style={{ marginTop: '4px' }}>
                        <small style={{ fontSize: '11px', fontWeight: '800', color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '8px' }}>
                          My Main Subjects List (Click any to instantly switch focus):
                        </small>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                          {interestedSubjectsList.map(subj => {
                            const isFocused = subj === activeSubject;
                            return (
                              <button
                                key={subj}
                                type="button"
                                onClick={() => handleSwitchStudentSubject(subj)}
                                onMouseEnter={() => speakHover(`${subj} subject badge`)}
                                style={{
                                  background: isFocused ? '#0284c7' : '#ffffff',
                                  color: isFocused ? '#ffffff' : '#0369a1',
                                  border: isFocused ? '2px solid #0284c7' : '1px solid #bae6fd',
                                  borderRadius: '20px',
                                  padding: '6px 14px',
                                  fontSize: '12px',
                                  fontWeight: '800',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  boxShadow: isFocused ? '0 2px 8px rgba(2, 132, 199, 0.3)' : 'none',
                                  transition: 'all 0.15s ease'
                                }}
                                title={`Click to focus dashboard on ${subj}`}
                              >
                                <span>{isFocused ? '🎯' : '📖'}</span>
                                <span>{subj}</span>
                                {interestedSubjectsList.length > 1 && (
                                  <span
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const updated = interestedSubjectsList.filter(s => s !== subj);
                                      setInterestedSubjectsList(updated);
                                      try {
                                        const session = JSON.parse(localStorage.getItem('auth_session') || '{}');
                                        const email = (session.email || '').trim().toLowerCase();
                                        if (email) localStorage.setItem(`student_interested_subjects_${email}`, JSON.stringify(updated));
                                      } catch (err) {}
                                      if (subj === activeSubject && updated.length > 0) {
                                        handleSwitchStudentSubject(updated[0]);
                                      }
                                    }}
                                    style={{
                                      marginLeft: '4px',
                                      borderRadius: '50%',
                                      width: '16px',
                                      height: '16px',
                                      display: 'grid',
                                      placeItems: 'center',
                                      fontSize: '11px',
                                      background: isFocused ? 'rgba(255,255,255,0.3)' : '#e2e8f0',
                                      color: isFocused ? '#ffffff' : '#475569'
                                    }}
                                    title={`Remove ${subj} from your list`}
                                  >
                                    ×
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <span style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic' }}>
                        💡 You can select multiple subjects of interest. Your entire dashboard (exams, study materials, oral vivas, performance tracking) strictly filters to your active focused subject.
                      </span>
                    </div>
                  </ProfileDetailCard>

                </div>

                {isEditingProfile && (
                  <div style={{ marginTop: '24px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                    <button 
                      onClick={() => { setIsEditingProfile(false); setProfileEditForm(studentProfile); }}
                      style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '12px 24px', borderRadius: '12px', fontWeight: '800', cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleSaveProfile}
                      style={{ background: '#0284c7', color: '#ffffff', border: 'none', padding: '12px 28px', borderRadius: '12px', fontWeight: '800', cursor: 'pointer' }}
                    >
                      💾 Save Profile Changes
                    </button>
                  </div>
                )}
              </div>

            </div>
          )}

        </div>
      </main>

    </div>
  );
}

// Helper Components
function StatCard({ icon, bg, border, label, value, action, onClick, progress, speechText }) {
  const narration = speechText || `${label}: ${value}. Click to ${action ? action.replace('→', '').trim() : 'view details'}`;
  return (
    <button 
      onClick={onClick}
      onMouseEnter={() => speakHover(narration)}
      data-speech={narration}
      data-narrate={narration}
      aria-label={narration}
      className="stat-3d card-3d"
      style={{
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: '16px',
        padding: '16px',
        textAlign: 'left',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        boxSizing: 'border-box'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontSize: '12px', fontWeight: '700', color: '#475569' }}>{label}</span>
        {icon}
      </div>
      <strong style={{ fontSize: '26px', color: '#0f172a', fontWeight: '800', margin: '4px 0' }}>{value}</strong>
      {progress !== undefined && (
        <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '4px', margin: '6px 0', overflow: 'hidden' }}>
          <div style={{ width: `${progress}%`, height: '100%', background: '#22c55e', borderRadius: '4px' }} />
        </div>
      )}
      <small style={{ fontSize: '12px', color: '#0284c7', fontWeight: '700', marginTop: '6px' }}>{action}</small>
    </button>
  );
}

function ActionBadge({ icon, title, sub, onClick }) {
  const narration = `${title}. ${sub || ''}`;
  return (
    <button 
      onClick={onClick}
      onMouseEnter={() => speakHover(narration)}
      data-speech={narration}
      data-narrate={narration}
      aria-label={narration}
      style={{
        background: '#ffffff',
        border: '1px solid #ddd6fe',
        borderRadius: '12px',
        padding: '12px 8px',
        cursor: 'pointer',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '4px'
      }}
    >
      <span style={{ fontSize: '20px' }}>{icon}</span>
      <b style={{ fontSize: '12px', color: '#4c1d95', display: 'block' }}>{title}</b>
      <small style={{ fontSize: '10px', color: '#7c3aed' }}>{sub}</small>
    </button>
  );
}

function BotIcon({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="10" rx="2" />
      <circle cx="12" cy="5" r="2" />
      <path d="M12 7v4" />
      <line x1="8" y1="16" x2="8" y2="16" />
      <line x1="16" y1="16" x2="16" y2="16" />
    </svg>
  );
}

function ProfileDetailCard({ label, value, subValue, subLabel, isEditing, field, subField, categories, formState, setFormState, children, style }) {
  return (
    <div style={{ background: '#f8fafc', padding: '18px 20px', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '6px', ...style }}>
      <small style={{ color: '#0284c7', fontSize: '11px', fontWeight: '800', letterSpacing: '0.5px' }}>{label}</small>
      {children ? (
        children
      ) : isEditing ? (
        categories ? (
          <select 
            value={formState[field] || ''} 
            onChange={(e) => setFormState({ ...formState, [field]: e.target.value })}
            style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '2px solid #0284c7', background: '#ffffff', fontSize: '14px', fontWeight: '700', color: '#0f172a', boxSizing: 'border-box' }}
          >
            <option value="">-- Select Your Course / Qualification Level --</option>
            {categories.map((catGroup, gIdx) => (
              <optgroup key={gIdx} label={catGroup.category}>
                {catGroup.options.map((opt, oIdx) => (
                  <option key={oIdx} value={opt}>{opt}</option>
                ))}
              </optgroup>
            ))}
          </select>
        ) : (
          <input 
            type="text" 
            value={formState[field] || ''} 
            onChange={(e) => setFormState({ ...formState, [field]: e.target.value })} 
            style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px', fontWeight: '700', boxSizing: 'border-box' }}
          />
        )
      ) : (
        value ? (
          <b style={{ fontSize: '15px', color: '#0f172a', fontWeight: '800' }}>{value}</b>
        ) : (
          <span style={{ fontSize: '14px', color: '#94a3b8', fontStyle: 'italic', fontWeight: '500' }}>Not Provided</span>
        )
      )}

      {subLabel && (
        <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed #cbd5e1' }}>
          <small style={{ color: '#0284c7', fontSize: '11px', fontWeight: '800', letterSpacing: '0.5px' }}>{subLabel}</small>
          {isEditing && subField ? (
            <input 
              type="text" 
              value={formState[subField] || ''} 
              onChange={(e) => setFormState({ ...formState, [subField]: e.target.value })} 
              style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px', fontWeight: '700', boxSizing: 'border-box', marginTop: '4px' }}
            />
          ) : subValue ? (
            <b style={{ display: 'block', fontSize: '14px', color: '#334155', fontWeight: '700', marginTop: '2px' }}>{subValue}</b>
          ) : (
            <span style={{ display: 'block', fontSize: '13px', color: '#94a3b8', fontStyle: 'italic', fontWeight: '500', marginTop: '2px' }}>Not Provided</span>
          )}
        </div>
      )}
    </div>
  );
}
