import { Label } from './label';
import { Input } from './input';
import { Textarea } from './textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';
import { cn } from '@/lib/utils';

interface BaseFieldProps {
  label: string;
  name: string;
  required?: boolean;
  error?: string;
  hint?: string;
  className?: string;
}

interface InputFieldProps extends BaseFieldProps {
  type: 'text' | 'email' | 'tel' | 'date' | 'number';
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
}

interface TextareaFieldProps extends BaseFieldProps {
  type: 'textarea';
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  rows?: number;
}

interface SelectFieldProps extends BaseFieldProps {
  type: 'select';
  options: { label: string; value: string }[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
}

type FormFieldProps = InputFieldProps | TextareaFieldProps | SelectFieldProps;

export function FormField(props: FormFieldProps) {
  const { label, name, required, error, hint, className } = props;

  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor={name}>
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </Label>

      {props.type === 'textarea' ? (
        <Textarea
          id={name}
          name={name}
          placeholder={props.placeholder}
          value={props.value}
          onChange={(e) => props.onChange?.(e.target.value)}
          rows={props.rows}
          className={error ? 'border-red-500' : ''}
        />
      ) : props.type === 'select' ? (
        <Select value={props.value} onValueChange={props.onChange}>
          <SelectTrigger className={error ? 'border-red-500' : ''}>
            <SelectValue placeholder={props.placeholder} />
          </SelectTrigger>
          <SelectContent>
            {props.options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input
          id={name}
          name={name}
          type={props.type}
          placeholder={props.placeholder}
          value={props.value}
          onChange={(e) => props.onChange?.(e.target.value)}
          className={error ? 'border-red-500' : ''}
        />
      )}

      {hint && !error && (
        <p className="text-sm text-gray-500">{hint}</p>
      )}
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
