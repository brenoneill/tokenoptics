interface Props {
  text: string;
}

export function TextBlock({ text }: Props) {
  return (
    <div className="whitespace-pre-wrap text-sm leading-relaxed text-fg">
      {text}
    </div>
  );
}
