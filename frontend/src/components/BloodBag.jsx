export default function BloodBag({ stock, index }) {
  const level = Math.round(60 * Math.min(stock.units / 40, 1));
  const note = stock.units === 0 ? 'None in stock'
    : stock.units < 5 ? `${stock.units} units, low`
    : `${stock.units} units`;
  const clipId = `clip-${index}`;
  return (
    <div className={`bag${stock.units < 5 ? ' low' : ''}`}>
      <svg viewBox="0 0 60 84" role="img" aria-label={`${stock.bloodGroup}: ${note}`}>
        <defs>
          <clipPath id={clipId}><rect x="8" y="18" width="44" height="60" rx="12" /></clipPath>
        </defs>
        <rect className="tube" x="25" y="2" width="10" height="14" rx="2" />
        <rect className="shell" x="8" y="18" width="44" height="60" rx="12" />
        <rect className="fill" x="8" y={78 - level} width="44" height={level} clipPath={`url(#${clipId})`} />
      </svg>
      <b>{stock.bloodGroup}</b>
      <small>{note}</small>
    </div>
  );
}
