const MIN_DB = -100;
const EPSILON = 1.0e-8;

export function computeDecibels(timeDomainData) {
  if (!timeDomainData?.length) {
    return MIN_DB;
  }

  let sumSquares = 0;
  for (let i = 0; i < timeDomainData.length; i += 1) {
    const sample = timeDomainData[i];
    sumSquares += sample * sample;
  }

  const rms = Math.sqrt(sumSquares / timeDomainData.length) || EPSILON;
  const decibels = 20 * Math.log10(rms);
  return Math.max(MIN_DB, decibels);
}

export function normalizeDecibels(decibels, floor = -90, ceiling = 0) {
  const clamped = Math.min(Math.max(decibels, floor), ceiling);
  return (clamped - floor) / (ceiling - floor);
}
