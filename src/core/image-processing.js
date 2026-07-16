function createCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

async function loadDrawable(blob) {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(blob, { imageOrientation: 'from-image' });
    } catch {
      return createImageBitmap(blob);
    }
  }
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(blob);
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Não foi possível abrir a imagem.'));
    };
    image.src = url;
  });
}

function grayscale(data) {
  for (let index = 0; index < data.length; index += 4) {
    const value = Math.round(data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114);
    data[index] = value;
    data[index + 1] = value;
    data[index + 2] = value;
  }
}

function percentile(histogram, total, fraction) {
  const target = total * fraction;
  let accumulated = 0;
  for (let value = 0; value < histogram.length; value += 1) {
    accumulated += histogram[value];
    if (accumulated >= target) return value;
  }
  return 255;
}

function autoContrast(data) {
  const histogram = new Uint32Array(256);
  for (let index = 0; index < data.length; index += 4) histogram[data[index]] += 1;
  const pixels = data.length / 4;
  const low = percentile(histogram, pixels, 0.015);
  const high = percentile(histogram, pixels, 0.985);
  const span = Math.max(12, high - low);
  for (let index = 0; index < data.length; index += 4) {
    const value = Math.max(0, Math.min(255, ((data[index] - low) * 255) / span));
    data[index] = value;
    data[index + 1] = value;
    data[index + 2] = value;
  }
}

function sharpen(data, width, height, amount = 0.55) {
  const source = new Uint8ClampedArray(data);
  const sample = (x, y) => source[(y * width + x) * 4];
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = (y * width + x) * 4;
      const center = sample(x, y);
      const laplacian = center * 5 - sample(x - 1, y) - sample(x + 1, y) - sample(x, y - 1) - sample(x, y + 1);
      const value = Math.max(0, Math.min(255, center * (1 - amount) + laplacian * amount));
      data[index] = value;
      data[index + 1] = value;
      data[index + 2] = value;
    }
  }
}

function otsuThreshold(data) {
  const histogram = new Uint32Array(256);
  for (let index = 0; index < data.length; index += 4) histogram[data[index]] += 1;
  const total = data.length / 4;
  let totalSum = 0;
  for (let i = 0; i < 256; i += 1) totalSum += i * histogram[i];
  let backgroundWeight = 0;
  let backgroundSum = 0;
  let maxVariance = -1;
  let threshold = 128;
  for (let i = 0; i < 256; i += 1) {
    backgroundWeight += histogram[i];
    if (!backgroundWeight) continue;
    const foregroundWeight = total - backgroundWeight;
    if (!foregroundWeight) break;
    backgroundSum += i * histogram[i];
    const backgroundMean = backgroundSum / backgroundWeight;
    const foregroundMean = (totalSum - backgroundSum) / foregroundWeight;
    const variance = backgroundWeight * foregroundWeight * (backgroundMean - foregroundMean) ** 2;
    if (variance > maxVariance) {
      maxVariance = variance;
      threshold = i;
    }
  }
  return threshold;
}

function applyThreshold(data, offset = 5) {
  const threshold = otsuThreshold(data) + offset;
  for (let index = 0; index < data.length; index += 4) {
    const value = data[index] < threshold ? 0 : 255;
    data[index] = value;
    data[index + 1] = value;
    data[index + 2] = value;
  }
}

function applyAdaptiveThreshold(data, width, height, radius = 18, bias = 9) {
  const stride = width + 1;
  const integral = new Uint32Array((width + 1) * (height + 1));
  for (let y = 1; y <= height; y += 1) {
    let rowSum = 0;
    for (let x = 1; x <= width; x += 1) {
      rowSum += data[((y - 1) * width + (x - 1)) * 4];
      integral[y * stride + x] = integral[(y - 1) * stride + x] + rowSum;
    }
  }
  for (let y = 0; y < height; y += 1) {
    const y0 = Math.max(0, y - radius);
    const y1 = Math.min(height - 1, y + radius);
    for (let x = 0; x < width; x += 1) {
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(width - 1, x + radius);
      const count = (x1 - x0 + 1) * (y1 - y0 + 1);
      const sum = integral[(y1 + 1) * stride + (x1 + 1)]
        - integral[y0 * stride + (x1 + 1)]
        - integral[(y1 + 1) * stride + x0]
        + integral[y0 * stride + x0];
      const mean = sum / count;
      const index = (y * width + x) * 4;
      const value = data[index] < mean - bias ? 0 : 255;
      data[index] = value;
      data[index + 1] = value;
      data[index + 2] = value;
    }
  }
}

function rotateCanvas(source, angleDegrees) {
  if (Math.abs(angleDegrees) < 0.05) return source;
  const radians = angleDegrees * Math.PI / 180;
  const sin = Math.abs(Math.sin(radians));
  const cos = Math.abs(Math.cos(radians));
  const width = Math.ceil(source.width * cos + source.height * sin);
  const height = Math.ceil(source.width * sin + source.height * cos);
  const canvas = createCanvas(width, height);
  const context = canvas.getContext('2d', { alpha: false });
  context.fillStyle = '#fff';
  context.fillRect(0, 0, width, height);
  context.translate(width / 2, height / 2);
  context.rotate(radians);
  context.drawImage(source, -source.width / 2, -source.height / 2);
  return canvas;
}

function projectionScore(source, angle) {
  const rotated = rotateCanvas(source, angle);
  const context = rotated.getContext('2d', { willReadFrequently: true });
  const { data } = context.getImageData(0, 0, rotated.width, rotated.height);
  const rows = new Float64Array(rotated.height);
  for (let y = 0; y < rotated.height; y += 1) {
    let ink = 0;
    for (let x = 0; x < rotated.width; x += 2) {
      const index = (y * rotated.width + x) * 4;
      const gray = data[index] * .299 + data[index + 1] * .587 + data[index + 2] * .114;
      if (gray < 150) ink += 1;
    }
    rows[y] = ink;
  }
  let score = 0;
  for (let y = 1; y < rows.length; y += 1) score += (rows[y] - rows[y - 1]) ** 2;
  return score;
}

function estimateSkewAngle(source) {
  const scale = Math.min(1, 620 / Math.max(source.width, source.height));
  const preview = createCanvas(Math.max(1, Math.round(source.width * scale)), Math.max(1, Math.round(source.height * scale)));
  const context = preview.getContext('2d', { alpha: false });
  context.fillStyle = '#fff';
  context.fillRect(0, 0, preview.width, preview.height);
  context.drawImage(source, 0, 0, preview.width, preview.height);
  let bestAngle = 0;
  let bestScore = -1;
  for (let angle = -6; angle <= 6; angle += 1) {
    const score = projectionScore(preview, angle);
    if (score > bestScore) {
      bestScore = score;
      bestAngle = angle;
    }
  }
  const coarse = bestAngle;
  for (let angle = coarse - 0.75; angle <= coarse + 0.75; angle += 0.25) {
    const score = projectionScore(preview, angle);
    if (score > bestScore) {
      bestScore = score;
      bestAngle = angle;
    }
  }
  return Math.abs(bestAngle) <= 0.25 ? 0 : bestAngle;
}

function processCanvas(sourceCanvas, { binary = false, adaptive = false, sharpenAmount = 0.45 } = {}) {
  const canvas = createCanvas(sourceCanvas.width, sourceCanvas.height);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(sourceCanvas, 0, 0);
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  grayscale(imageData.data);
  autoContrast(imageData.data);
  sharpen(imageData.data, canvas.width, canvas.height, sharpenAmount);
  if (adaptive) applyAdaptiveThreshold(imageData.data, canvas.width, canvas.height);
  else if (binary) applyThreshold(imageData.data);
  context.putImageData(imageData, 0, 0);
  return canvas;
}

function cropCanvas(source, topFraction = 0.42, heightFraction = 0.58) {
  const sourceY = Math.round(source.height * topFraction);
  const sourceHeight = Math.max(1, Math.round(source.height * heightFraction));
  const canvas = createCanvas(source.width, sourceHeight);
  canvas.getContext('2d').drawImage(source, 0, sourceY, source.width, sourceHeight, 0, 0, source.width, sourceHeight);
  return canvas;
}

function cropBand(source, centerFraction, heightFraction = 0.18) {
  const height = Math.max(1, Math.round(source.height * heightFraction));
  const center = Math.round(source.height * centerFraction);
  const sourceY = Math.max(0, Math.min(source.height - height, center - Math.round(height / 2)));
  const canvas = createCanvas(source.width, height);
  const context = canvas.getContext('2d', { alpha: false });
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(source, 0, sourceY, source.width, height, 0, 0, source.width, height);
  return canvas;
}


function detectTextLineCrops(source) {
  const scale = Math.min(1, 980 / Math.max(source.width, source.height));
  const preview = createCanvas(source.width * scale, source.height * scale);
  const context = preview.getContext('2d', { alpha: false, willReadFrequently: true });
  context.fillStyle = '#fff';
  context.fillRect(0, 0, preview.width, preview.height);
  context.drawImage(source, 0, 0, preview.width, preview.height);
  const { data } = context.getImageData(0, 0, preview.width, preview.height);
  const ratios = new Float32Array(preview.height);
  for (let y = 0; y < preview.height; y += 1) {
    let dark = 0;
    for (let x = 0; x < preview.width; x += 2) {
      const index = (y * preview.width + x) * 4;
      const gray = data[index] * .299 + data[index + 1] * .587 + data[index + 2] * .114;
      if (gray < 165) dark += 1;
    }
    ratios[y] = dark / Math.max(1, preview.width / 2);
  }
  const smoothed = new Float32Array(preview.height);
  for (let y = 0; y < preview.height; y += 1) {
    let sum = 0;
    let count = 0;
    for (let offset = -2; offset <= 2; offset += 1) {
      const row = y + offset;
      if (row >= 0 && row < preview.height) { sum += ratios[row]; count += 1; }
    }
    smoothed[y] = sum / Math.max(1, count);
  }

  const start = Math.round(preview.height * 0.45);
  const end = Math.round(preview.height * 0.90);
  const threshold = 0.012;
  const groups = [];
  let activeStart = -1;
  let lastInk = -1;
  for (let y = start; y < end; y += 1) {
    if (smoothed[y] >= threshold) {
      if (activeStart < 0) activeStart = y;
      lastInk = y;
    } else if (activeStart >= 0 && y - lastInk > 4) {
      groups.push({ y0: activeStart, y1: lastInk });
      activeStart = -1;
      lastInk = -1;
    }
  }
  if (activeStart >= 0) groups.push({ y0: activeStart, y1: Math.max(activeStart, lastInk) });

  return groups
    .filter((group) => group.y1 - group.y0 >= 3 && group.y1 - group.y0 <= preview.height * 0.075)
    .map((group) => {
      const center = (group.y0 + group.y1) / 2;
      const height = group.y1 - group.y0 + 1;
      let ink = 0;
      for (let y = group.y0; y <= group.y1; y += 1) ink += smoothed[y];
      const centerFraction = center / preview.height;
      const locationScore = Math.max(0, 1 - Math.abs(centerFraction - 0.68) / 0.24);
      return { ...group, centerFraction, height, score: ink / height + locationScore * 0.055 };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 7)
    .sort((a, b) => a.y0 - b.y0)
    .map((group) => {
      const scaleBack = 1 / scale;
      const lineHeight = Math.max(8, group.height * scaleBack);
      const y0 = Math.max(0, Math.floor(group.y0 * scaleBack - lineHeight * 0.85));
      const y1 = Math.min(source.height, Math.ceil(group.y1 * scaleBack + lineHeight * 0.85));
      const canvas = createCanvas(source.width, y1 - y0);
      const cropContext = canvas.getContext('2d', { alpha: false });
      cropContext.fillStyle = '#fff';
      cropContext.fillRect(0, 0, canvas.width, canvas.height);
      cropContext.drawImage(source, 0, y0, source.width, y1 - y0, 0, 0, source.width, y1 - y0);
      return { canvas, centerFraction: group.centerFraction };
    });
}

function cropHorizontal(source, startFraction = 0, endFraction = 1) {
  const x0 = Math.max(0, Math.min(source.width - 1, Math.round(source.width * startFraction)));
  const x1 = Math.max(x0 + 1, Math.min(source.width, Math.round(source.width * endFraction)));
  const canvas = createCanvas(x1 - x0, source.height);
  const context = canvas.getContext('2d', { alpha: false });
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(source, x0, 0, x1 - x0, source.height, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export async function makeOcrVariants(blob) {
  const drawable = await loadDrawable(blob);
  const width = drawable.width || drawable.naturalWidth;
  const height = drawable.height || drawable.naturalHeight;
  const longest = Math.max(width, height);
  // Impressões térmicas estreitas precisam de mais pixels antes do OCR.
  const upscale = Math.max(2.2, Math.min(5.2, 3200 / longest));
  const targetWidth = Math.round(width * upscale);
  const targetHeight = Math.round(height * upscale);
  const originalBase = createCanvas(targetWidth, targetHeight);
  const originalContext = originalBase.getContext('2d', { alpha: false });
  originalContext.fillStyle = '#fff';
  originalContext.fillRect(0, 0, targetWidth, targetHeight);
  originalContext.imageSmoothingEnabled = true;
  originalContext.imageSmoothingQuality = 'high';
  originalContext.drawImage(drawable, 0, 0, targetWidth, targetHeight);
  drawable.close?.();

  const estimatedSkew = estimateSkewAngle(originalBase);
  const base = estimatedSkew ? rotateCanvas(originalBase, estimatedSkew) : originalBase;
  const enhanced = processCanvas(base, { binary: false, sharpenAmount: 0.66 });
  const lower = processCanvas(cropCanvas(base, 0.46, 0.46), { binary: false, sharpenAmount: 0.72 });
  const lowerAdaptive = processCanvas(cropCanvas(base, 0.50, 0.40), { adaptive: true, sharpenAmount: 0.42 });

  // O comprovante inteiro é preservado. Somente a análise cria ampliações internas
  // estreitas da região onde a linha DATA/HORA costuma aparecer.
  const detectedLines = detectTextLineCrops(base).map((item, index) => ({
    name: `linha térmica detectada ${index + 1} (${Math.round(item.centerFraction * 100)}%)`,
    canvas: processCanvas(item.canvas, { binary: false, sharpenAmount: 0.82 }),
    rawLine: true,
    constrained: true,
    priority: 15 - index * 0.25,
    dynamic: true,
  }));

  // O local exato da linha muda conforme o modelo do relógio. Estas faixas
  // cobrem comprovantes completos sem obrigar o usuário a fotografar de perto.
  const bandSpecs = [
    { center: 0.56, height: 0.095, priority: 7 },
    { center: 0.62, height: 0.095, priority: 10 },
    { center: 0.66, height: 0.086, priority: 13 },
    { center: 0.70, height: 0.078, priority: 13.5 },
    // Faixas estreitas extras para comprovantes completos do modelo enviado.
    // Nessa família de impressão, DATA/HORA costuma ficar entre 72% e 77%.
    { center: 0.725, height: 0.060, priority: 15 },
    { center: 0.745, height: 0.060, priority: 16 },
    { center: 0.748, height: 0.094, priority: 18, split: true },
    { center: 0.765, height: 0.060, priority: 15 },
    { center: 0.79, height: 0.080, priority: 10 },
    { center: 0.83, height: 0.095, priority: 7 },
  ];
  const bands = bandSpecs.flatMap((spec, index) => {
    const band = cropBand(base, spec.center, spec.height);
    const variants = [{
      name: `faixa DATA/HORA ${index + 1}`,
      canvas: processCanvas(band, { binary: false, sharpenAmount: 0.82 }),
      rawLine: true,
      constrained: true,
      priority: spec.priority,
    }, {
      name: `faixa DATA/HORA ${index + 1} linha única`,
      canvas: processCanvas(band, { binary: false, sharpenAmount: 0.68 }),
      singleLine: true,
      constrained: true,
      lineFocused: true,
      priority: spec.priority + 0.35,
    }];
    if (spec.split) {
      const pairId = `data-hora-${index}`;
      variants.push({
        name: `linha DATA/HORA ${index + 1} bloco`,
        canvas: band,
        singleBlock: true,
        focusedBlock: true,
        priority: spec.priority + 1,
      });
      variants.push({
        name: `campo DATA ${index + 1}`,
        canvas: processCanvas(cropHorizontal(band, 0, 0.62), { binary: false, sharpenAmount: 0.48 }),
        singleBlock: true,
        field: 'date',
        pairId,
        priority: spec.priority + 1.5,
      });
      variants.push({
        name: `campo HORA ${index + 1}`,
        canvas: processCanvas(cropHorizontal(band, 0.35, 1), { binary: false, sharpenAmount: 0.54 }),
        singleLine: true,
        constrained: true,
        field: 'time',
        pairId,
        priority: spec.priority + 1.5,
      });
    }
    if (index >= 1 && index <= 8) {
      variants.push({
        name: `faixa DATA/HORA ${index + 1} adaptativa`,
        canvas: processCanvas(band, { adaptive: true, sharpenAmount: 0.46 }),
        rawLine: true,
        constrained: true,
        priority: spec.priority - 0.5,
      });
    }
    return variants;
  });

  return [
    // Primeiro obtém a estrutura do documento; depois usa as linhas estreitas.
    { name: `documento alinhado${estimatedSkew ? ` (${estimatedSkew.toFixed(2)}°)` : ''}`, canvas: enhanced, structural: true, priority: 8 },
    ...detectedLines,
    ...bands,
    { name: 'região inferior', canvas: lower, sparse: true, priority: 4 },
    { name: 'região inferior adaptativa', canvas: lowerAdaptive, sparse: true, priority: 3 },
  ];
}

export async function prepareCloudOcrImage(blob, maxDimension = 1800) {
  const drawable = await loadDrawable(blob);
  const width = drawable.width || drawable.naturalWidth;
  const height = drawable.height || drawable.naturalHeight;
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  const canvas = createCanvas(width * scale, height * scale);
  const context = canvas.getContext('2d', { alpha: false });
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(drawable, 0, 0, canvas.width, canvas.height);
  drawable.close?.();
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error('Falha ao preparar imagem para OCR avançado.'))),
      'image/jpeg',
      0.9,
    );
  });
}

export async function analyzeImageQuality(blob) {
  const drawable = await loadDrawable(blob);
  const width = drawable.width || drawable.naturalWidth;
  const height = drawable.height || drawable.naturalHeight;
  const scale = Math.min(1, 520 / Math.max(width, height));
  const canvas = createCanvas(width * scale, height * scale);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(drawable, 0, 0, canvas.width, canvas.height);
  drawable.close?.();
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  const gray = new Float32Array(canvas.width * canvas.height);
  let sum = 0;
  for (let index = 0, pixel = 0; index < data.length; index += 4, pixel += 1) {
    const value = data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114;
    gray[pixel] = value;
    sum += value;
  }
  const brightness = sum / gray.length;
  let squared = 0;
  for (const value of gray) squared += (value - brightness) ** 2;
  const contrast = Math.sqrt(squared / gray.length);

  let laplacianSum = 0;
  let laplacianSquared = 0;
  let count = 0;
  for (let y = 1; y < canvas.height - 1; y += 1) {
    for (let x = 1; x < canvas.width - 1; x += 1) {
      const center = gray[y * canvas.width + x];
      const laplacian = gray[y * canvas.width + x - 1]
        + gray[y * canvas.width + x + 1]
        + gray[(y - 1) * canvas.width + x]
        + gray[(y + 1) * canvas.width + x]
        - 4 * center;
      laplacianSum += laplacian;
      laplacianSquared += laplacian ** 2;
      count += 1;
    }
  }
  const laplacianMean = laplacianSum / Math.max(1, count);
  const blurScore = laplacianSquared / Math.max(1, count) - laplacianMean ** 2;

  const issues = [];
  if (brightness < 65) issues.push('Imagem escura');
  if (brightness > 235) issues.push('Imagem muito clara');
  if (contrast < 28) issues.push('Baixo contraste');
  if (blurScore < 55) issues.push('Possível desfoque');
  if (Math.min(width, height) < 420) issues.push('Resolução baixa');

  const score = Math.max(0, Math.min(100,
    100
      - Math.max(0, 65 - brightness) * 0.5
      - Math.max(0, brightness - 235) * 0.7
      - Math.max(0, 28 - contrast) * 1.5
      - Math.max(0, 55 - blurScore) * 0.45
      - (Math.min(width, height) < 420 ? 12 : 0)));

  return {
    width,
    height,
    brightness: Math.round(brightness),
    contrast: Math.round(contrast),
    blurScore: Math.round(blurScore),
    score: Math.round(score),
    issues,
    label: score >= 78 ? 'Boa' : score >= 55 ? 'Aceitável' : 'Baixa',
  };
}

export async function rotateImage(blob, degrees) {
  const drawable = await loadDrawable(blob);
  const sourceWidth = drawable.width || drawable.naturalWidth;
  const sourceHeight = drawable.height || drawable.naturalHeight;
  const normalized = ((degrees % 360) + 360) % 360;
  const swap = normalized === 90 || normalized === 270;
  const canvas = createCanvas(swap ? sourceHeight : sourceWidth, swap ? sourceWidth : sourceHeight);
  const context = canvas.getContext('2d');
  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate((normalized * Math.PI) / 180);
  context.drawImage(drawable, -sourceWidth / 2, -sourceHeight / 2);
  drawable.close?.();
  return new Promise((resolve, reject) => {
    canvas.toBlob((result) => (result ? resolve(result) : reject(new Error('Falha ao girar a imagem.'))), blob.type || 'image/jpeg', 0.94);
  });
}

export async function makeThumbnail(blob, maxWidth = 480) {
  const drawable = await loadDrawable(blob);
  const width = drawable.width || drawable.naturalWidth;
  const height = drawable.height || drawable.naturalHeight;
  const scale = Math.min(1, maxWidth / width);
  const canvas = createCanvas(width * scale, height * scale);
  canvas.getContext('2d').drawImage(drawable, 0, 0, canvas.width, canvas.height);
  drawable.close?.();
  return new Promise((resolve, reject) => {
    canvas.toBlob((result) => (result ? resolve(result) : reject(new Error('Falha ao gerar miniatura.'))), 'image/jpeg', 0.78);
  });
}

export async function makeHighContrastImage(blob, maxDimension = 2400) {
  const drawable = await loadDrawable(blob);
  const sourceWidth = drawable.width || drawable.naturalWidth;
  const sourceHeight = drawable.height || drawable.naturalHeight;
  const scale = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight));
  const width = Math.round(sourceWidth * scale);
  const height = Math.round(sourceHeight * scale);
  const canvas = createCanvas(width, height);
  const context = canvas.getContext('2d', { alpha: false, willReadFrequently: true });
  context.fillStyle = '#fff';
  context.fillRect(0, 0, width, height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(drawable, 0, 0, width, height);
  drawable.close?.();

  const imageData = context.getImageData(0, 0, width, height);
  grayscale(imageData.data);
  autoContrast(imageData.data);
  sharpen(imageData.data, width, height, 0.42);
  applyAdaptiveThreshold(imageData.data, width, height, Math.max(10, Math.round(Math.min(width, height) / 70)), 7);
  context.putImageData(imageData, 0, 0);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error('Falha ao criar a fotografia em alto contraste.'))),
      'image/jpeg',
      0.93,
    );
  });
}
