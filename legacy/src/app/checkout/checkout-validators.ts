import { Directive, Input } from '@angular/core';
import {
  AbstractControl,
  NG_VALIDATORS,
  ValidationErrors,
  Validator,
} from '@angular/forms';

import { COUNTRIES } from '../models';

export type CheckoutField =
  | 'email'
  | 'fullName'
  | 'line1'
  | 'line2'
  | 'city'
  | 'postalCode'
  | 'country'
  | 'cardNumber'
  | 'expiry'
  | 'cvc';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const POSTAL_CODE_PATTERN = /^[A-Za-z0-9 ]{3,10}$/;
const EXPIRY_PATTERN = /^(0[1-9]|1[0-2])\/(\d{2})$/;
const CARD_NUMBER_PATTERN = /^\d{16}$/;
const CVC_PATTERN = /^\d{3}$/;

export function normalizeCardNumber(input: string): string {
  return input.replace(/ /g, '');
}

export function isLuhnValid(digits: string): boolean {
  if (!/^\d+$/.test(digits)) {
    return false;
  }
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let digit = Number(digits.charAt(digits.length - 1 - i));
    if (i % 2 === 1) {
      digit = digit * 2;
      if (digit > 9) {
        digit = digit - 9;
      }
    }
    sum = sum + digit;
  }
  return sum % 10 === 0;
}

export function parseExpiry(
  input: string,
): { month: number; year: number } | null {
  const match = EXPIRY_PATTERN.exec(input);
  if (!match) {
    return null;
  }
  return { month: Number(match[1]), year: 2000 + Number(match[2]) };
}

export function isExpired(
  expiry: { month: number; year: number },
  now: Date,
): boolean {
  return now.getTime() >= Date.UTC(expiry.year, expiry.month, 1);
}

type Rule = [(value: string) => boolean, string];

interface FieldRules {
  required: string | null;
  rules: Rule[];
}

function maxLength(max: number, message: string): Rule {
  return [(value) => value.length <= max, message];
}

function isValidEmail(value: string): boolean {
  return value.length <= 254 && EMAIL_PATTERN.test(value);
}

function isValidCardNumber(value: string): boolean {
  const digits = normalizeCardNumber(value);
  return CARD_NUMBER_PATTERN.test(digits) && isLuhnValid(digits);
}

function isCurrent(value: string): boolean {
  return !isExpired(parseExpiry(value)!, new Date());
}

const FIELD_RULES: { [field: string]: FieldRules } = {
  email: {
    required: 'Enter your email address',
    rules: [[isValidEmail, 'Enter a valid email address']],
  },
  fullName: {
    required: 'Enter your full name',
    rules: [maxLength(100, 'Use 100 characters or fewer')],
  },
  line1: {
    required: 'Enter your address',
    rules: [maxLength(200, 'Use 200 characters or fewer')],
  },
  line2: {
    required: null,
    rules: [maxLength(200, 'Use 200 characters or fewer')],
  },
  city: {
    required: 'Enter your city',
    rules: [maxLength(100, 'Use 100 characters or fewer')],
  },
  postalCode: {
    required: 'Enter your postal code',
    rules: [
      [(value) => POSTAL_CODE_PATTERN.test(value), 'Enter a valid postal code'],
    ],
  },
  country: {
    required: 'Select your country',
    rules: [
      [
        (value) => COUNTRIES.some((c) => c.code === value),
        'Select your country',
      ],
    ],
  },
  cardNumber: {
    required: 'Enter your card number',
    rules: [[isValidCardNumber, 'Enter a valid card number']],
  },
  expiry: {
    required: 'Enter the card expiry date',
    rules: [
      [(value) => parseExpiry(value) !== null, 'Enter the expiry as MM/YY'],
      [isCurrent, 'Your card has expired'],
    ],
  },
  cvc: {
    required: 'Enter the CVC',
    rules: [[(value) => CVC_PATTERN.test(value), 'Enter a valid 3 digit CVC']],
  },
};

export function checkoutFieldError(
  field: CheckoutField,
  value: any,
): string | null {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  const spec = FIELD_RULES[field];
  if (trimmed === '') {
    return spec.required;
  }
  const failing = spec.rules.find(([passes]) => !passes(trimmed));
  return failing ? failing[1] : null;
}

@Directive({
  selector: '[appCheckoutField]',
  providers: [
    {
      provide: NG_VALIDATORS,
      useExisting: CheckoutFieldValidatorDirective,
      multi: true,
    },
  ],
})
export class CheckoutFieldValidatorDirective implements Validator {
  @Input() appCheckoutField!: CheckoutField;

  validate(control: AbstractControl): ValidationErrors | null {
    const message = checkoutFieldError(this.appCheckoutField, control.value);
    return message ? { checkout: message } : null;
  }
}
