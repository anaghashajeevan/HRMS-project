import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';

type BaseProps = {
  label: string;
  helper?: string;
};

type InputProps = BaseProps &
  InputHTMLAttributes<HTMLInputElement> & {
    textarea?: false;
  };

type TextareaProps = BaseProps &
  TextareaHTMLAttributes<HTMLTextAreaElement> & {
    textarea: true;
  };

export function FormField(props: InputProps | TextareaProps) {
  const { label, helper } = props;
  const shared =
    'min-h-11 w-full rounded-xl border border-white/10 bg-[#070A12]/80 px-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-blue-400/60 focus:ring-2 focus:ring-blue-500/20';

  return (
    <label className="grid gap-2">
      <span className="text-sm font-medium text-slate-300">{label}</span>
      {props.textarea ? (
        <TextareaControl {...props} sharedClassName={shared} />
      ) : (
        <InputControl {...props} sharedClassName={shared} />
      )}
      {helper ? <span className="text-xs leading-5 text-slate-500">{helper}</span> : null}
    </label>
  );
}

function TextareaControl({
  label: _label,
  helper: _helper,
  textarea: _textarea,
  sharedClassName,
  className,
  rows,
  ...props
}: TextareaProps & { sharedClassName: string }) {
  return <textarea {...props} className={`${sharedClassName} resize-y py-3 ${className || ''}`} rows={rows || 3} />;
}

function InputControl({
  label: _label,
  helper: _helper,
  textarea: _textarea,
  sharedClassName,
  className,
  ...props
}: InputProps & { sharedClassName: string }) {
  return <input {...props} className={`${sharedClassName} ${className || ''}`} />;
}