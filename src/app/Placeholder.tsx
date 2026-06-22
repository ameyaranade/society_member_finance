interface PlaceholderProps { name: string }

export default function Placeholder({ name }: PlaceholderProps) {
  return <div style={{ padding: 32 }}>{name} — coming soon</div>;
}
