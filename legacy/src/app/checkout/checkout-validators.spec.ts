import { fakeAsync } from '@angular/core/testing';
import { FormControl } from '@angular/forms';

import {
  CheckoutField,
  CheckoutFieldValidatorDirective,
  checkoutFieldError,
  isExpired,
  isLuhnValid,
  normalizeCardNumber,
  parseExpiry,
} from './checkout-validators';
import { COUNTRIES } from '../models';

const NOW = new Date('2026-10-21T12:00:00Z');

function chars(count: number): string {
  return 'a'.repeat(count);
}

interface FieldCase {
  field: CheckoutField;
  input: string;
  value: any;
  message: string | null;
}

const CONTRACT_FIELD_CASES: FieldCase[] = [
  {
    field: 'email',
    input: 'nothing',
    value: '',
    message: 'Enter your email address',
  },
  {
    field: 'email',
    input: 'only spaces',
    value: '   ',
    message: 'Enter your email address',
  },
  {
    field: 'email',
    input: 'no value at all',
    value: null,
    message: 'Enter your email address',
  },
  {
    field: 'email',
    input: 'a missing dot',
    value: 'ada@example',
    message: 'Enter a valid email address',
  },
  {
    field: 'email',
    input: 'a missing at sign',
    value: 'ada.example.com',
    message: 'Enter a valid email address',
  },
  {
    field: 'email',
    input: 'two at signs',
    value: 'ada@@example.com',
    message: 'Enter a valid email address',
  },
  {
    field: 'email',
    input: 'no local part',
    value: '@example.com',
    message: 'Enter a valid email address',
  },
  {
    field: 'email',
    input: 'a space before the address',
    value: 'ada lovelace@example.com',
    message: 'Enter a valid email address',
  },
  {
    field: 'email',
    input: 'a space after the address',
    value: 'ada@example.com extra',
    message: 'Enter a valid email address',
  },
  {
    field: 'email',
    input: '255 characters',
    value: chars(243) + '@example.com',
    message: 'Enter a valid email address',
  },
  {
    field: 'email',
    input: '254 characters',
    value: chars(242) + '@example.com',
    message: null,
  },
  {
    field: 'email',
    input: 'surrounding spaces',
    value: '  ada@example.com  ',
    message: null,
  },
  {
    field: 'fullName',
    input: 'nothing',
    value: '',
    message: 'Enter your full name',
  },
  {
    field: 'fullName',
    input: 'only spaces',
    value: '    ',
    message: 'Enter your full name',
  },
  {
    field: 'fullName',
    input: '101 characters',
    value: chars(101),
    message: 'Use 100 characters or fewer',
  },
  {
    field: 'fullName',
    input: '100 characters',
    value: chars(100),
    message: null,
  },
  {
    field: 'fullName',
    input: '100 characters inside spaces',
    value: '  ' + chars(100) + '  ',
    message: null,
  },
  {
    field: 'fullName',
    input: 'a non ASCII name',
    value: 'Zoë Ångström',
    message: null,
  },
  {
    field: 'line1',
    input: 'nothing',
    value: '',
    message: 'Enter your address',
  },
  {
    field: 'line1',
    input: 'only spaces',
    value: '  ',
    message: 'Enter your address',
  },
  {
    field: 'line1',
    input: '201 characters',
    value: chars(201),
    message: 'Use 200 characters or fewer',
  },
  {
    field: 'line1',
    input: '200 characters',
    value: chars(200),
    message: null,
  },
  { field: 'line2', input: 'nothing', value: '', message: null },
  { field: 'line2', input: 'only spaces', value: '   ', message: null },
  { field: 'line2', input: 'no value at all', value: null, message: null },
  {
    field: 'line2',
    input: '201 characters',
    value: chars(201),
    message: 'Use 200 characters or fewer',
  },
  {
    field: 'line2',
    input: '200 characters',
    value: chars(200),
    message: null,
  },
  { field: 'city', input: 'nothing', value: '', message: 'Enter your city' },
  {
    field: 'city',
    input: 'only spaces',
    value: '  ',
    message: 'Enter your city',
  },
  {
    field: 'city',
    input: '101 characters',
    value: chars(101),
    message: 'Use 100 characters or fewer',
  },
  {
    field: 'city',
    input: '100 characters',
    value: chars(100),
    message: null,
  },
  { field: 'city', input: 'a non ASCII city', value: 'München', message: null },
  {
    field: 'postalCode',
    input: 'nothing',
    value: '',
    message: 'Enter your postal code',
  },
  {
    field: 'postalCode',
    input: 'only spaces',
    value: '   ',
    message: 'Enter your postal code',
  },
  {
    field: 'postalCode',
    input: 'two characters',
    value: 'AB',
    message: 'Enter a valid postal code',
  },
  {
    field: 'postalCode',
    input: 'two characters inside spaces',
    value: ' AB ',
    message: 'Enter a valid postal code',
  },
  {
    field: 'postalCode',
    input: 'eleven characters',
    value: '12345678901',
    message: 'Enter a valid postal code',
  },
  {
    field: 'postalCode',
    input: 'a hyphen',
    value: 'SW1A-1AA',
    message: 'Enter a valid postal code',
  },
  {
    field: 'postalCode',
    input: 'a non ASCII letter',
    value: 'ZÖ 123',
    message: 'Enter a valid postal code',
  },
  {
    field: 'postalCode',
    input: 'three characters',
    value: 'A1B',
    message: null,
  },
  {
    field: 'postalCode',
    input: 'ten characters',
    value: '1234567890',
    message: null,
  },
  {
    field: 'postalCode',
    input: 'a UK code',
    value: 'SW1A 1AA',
    message: null,
  },
  {
    field: 'postalCode',
    input: 'a Canadian code without spaces',
    value: 'K1A0B1',
    message: null,
  },
  {
    field: 'country',
    input: 'nothing',
    value: '',
    message: 'Select your country',
  },
  {
    field: 'country',
    input: 'an unlisted code',
    value: 'FR',
    message: 'Select your country',
  },
  {
    field: 'country',
    input: 'a lower case code',
    value: 'gb',
    message: 'Select your country',
  },
  {
    field: 'country',
    input: 'a code inside spaces',
    value: ' GB ',
    message: null,
  },
  { field: 'country', input: 'US', value: 'US', message: null },
  { field: 'country', input: 'CA', value: 'CA', message: null },
  { field: 'country', input: 'GB', value: 'GB', message: null },
  { field: 'country', input: 'DE', value: 'DE', message: null },
  { field: 'country', input: 'NL', value: 'NL', message: null },
  { field: 'cvc', input: 'nothing', value: '', message: 'Enter the CVC' },
  { field: 'cvc', input: 'only spaces', value: '  ', message: 'Enter the CVC' },
  {
    field: 'cvc',
    input: 'two digits',
    value: '12',
    message: 'Enter a valid 3 digit CVC',
  },
  {
    field: 'cvc',
    input: 'four digits',
    value: '1234',
    message: 'Enter a valid 3 digit CVC',
  },
  {
    field: 'cvc',
    input: 'a letter',
    value: '12a',
    message: 'Enter a valid 3 digit CVC',
  },
  { field: 'cvc', input: 'three digits', value: '123', message: null },
  {
    field: 'cvc',
    input: 'three digits inside spaces',
    value: ' 123 ',
    message: null,
  },
];

const CARD_CASES: FieldCase[] = [
  {
    field: 'cardNumber',
    input: 'nothing',
    value: '',
    message: 'Enter your card number',
  },
  {
    field: 'cardNumber',
    input: 'only spaces',
    value: '    ',
    message: 'Enter your card number',
  },
  {
    field: 'cardNumber',
    input: 'a failing check digit',
    value: '4242424242424241',
    message: 'Enter a valid card number',
  },
  {
    field: 'cardNumber',
    input: '15 digits that pass Luhn',
    value: '378282246310005',
    message: 'Enter a valid card number',
  },
  {
    field: 'cardNumber',
    input: '17 digits that pass Luhn',
    value: '04242424242424242',
    message: 'Enter a valid card number',
  },
  {
    field: 'cardNumber',
    input: 'hyphens',
    value: '4242-4242-4242-4242',
    message: 'Enter a valid card number',
  },
  {
    field: 'cardNumber',
    input: 'a letter',
    value: '4242 4242 4242 424a',
    message: 'Enter a valid card number',
  },
  {
    field: 'cardNumber',
    input: 'grouped digits',
    value: '4242 4242 4242 4242',
    message: null,
  },
  {
    field: 'cardNumber',
    input: 'the declined test card',
    value: '4000 0000 0000 0002',
    message: null,
  },
  {
    field: 'cardNumber',
    input: 'another valid card inside spaces',
    value: ' 5555555555554444 ',
    message: null,
  },
  {
    field: 'expiry',
    input: 'nothing',
    value: '',
    message: 'Enter the card expiry date',
  },
  {
    field: 'expiry',
    input: 'only spaces',
    value: '   ',
    message: 'Enter the card expiry date',
  },
  {
    field: 'expiry',
    input: 'a one digit month',
    value: '1/40',
    message: 'Enter the expiry as MM/YY',
  },
  {
    field: 'expiry',
    input: 'month 13',
    value: '13/40',
    message: 'Enter the expiry as MM/YY',
  },
  {
    field: 'expiry',
    input: 'month 00',
    value: '00/40',
    message: 'Enter the expiry as MM/YY',
  },
  {
    field: 'expiry',
    input: 'a one digit year',
    value: '12/4',
    message: 'Enter the expiry as MM/YY',
  },
  {
    field: 'expiry',
    input: 'a three digit year',
    value: '12/400',
    message: 'Enter the expiry as MM/YY',
  },
  {
    field: 'expiry',
    input: 'a hyphen',
    value: '12-40',
    message: 'Enter the expiry as MM/YY',
  },
  {
    field: 'expiry',
    input: 'last month',
    value: '09/26',
    message: 'Your card has expired',
  },
  {
    field: 'expiry',
    input: 'an old year',
    value: '01/20',
    message: 'Your card has expired',
  },
  {
    field: 'expiry',
    input: 'a later month of last year',
    value: '12/25',
    message: 'Your card has expired',
  },
  {
    field: 'expiry',
    input: 'this month',
    value: '10/26',
    message: null,
  },
  {
    field: 'expiry',
    input: 'next month',
    value: '11/26',
    message: null,
  },
  {
    field: 'expiry',
    input: 'a far future date inside spaces',
    value: ' 12/40 ',
    message: null,
  },
];

const LUHN_CASES: [string, boolean][] = [
  ['4242424242424242', true],
  ['4000000000000002', true],
  ['5555555555554444', true],
  ['4242424242424241', false],
  ['', false],
  ['42424242424242a2', false],
  ['4242 4242 4242 4242', false],
  ['0 4242424242424242', false],
];

const EXPIRY_REJECTS = ['1/40', '13/40', '00/40', '12/4', '12-40', ' 12/40'];

function describeCase(c: FieldCase): string {
  return c.field + ' with ' + c.input + ' gives ' + (c.message || 'no error');
}

describe('checkout validators', () => {
  CONTRACT_FIELD_CASES.forEach((c) => {
    it(
      '[BR-K2] ' + describeCase(c),
      fakeAsync(() => {
        jasmine.clock().mockDate(NOW);
        expect(checkoutFieldError(c.field, c.value)).toBe(c.message);
      }),
    );
  });

  CARD_CASES.forEach((c) => {
    it(
      '[BR-K3] card rule ' + describeCase(c),
      fakeAsync(() => {
        jasmine.clock().mockDate(NOW);
        expect(checkoutFieldError(c.field, c.value)).toBe(c.message);
      }),
    );
  });

  LUHN_CASES.forEach(([digits, valid]) => {
    it('[BR-K3] card rule luhn "' + digits + '" is ' + valid, () => {
      expect(isLuhnValid(digits)).toBe(valid);
    });
  });

  it('[BR-K3] card rule removes spaces only from card numbers', () => {
    expect(normalizeCardNumber('4242 4242 4242 4242')).toBe('4242424242424242');
    expect(normalizeCardNumber(' 42  42 ')).toBe('4242');
    expect(normalizeCardNumber('4242\t4242-42')).toBe('4242\t4242-42');
  });

  it('[BR-K3] card rule parses MM/YY in the 2000s', () => {
    expect(parseExpiry('12/40')).toEqual({ month: 12, year: 2040 });
    expect(parseExpiry('01/20')).toEqual({ month: 1, year: 2020 });
    expect(parseExpiry('05/00')).toEqual({ month: 5, year: 2000 });
  });

  EXPIRY_REJECTS.forEach((value) => {
    it('[BR-K3] card rule rejects the expiry "' + value + '"', () => {
      expect(parseExpiry(value)).toBeNull();
    });
  });

  it('[BR-K3] card rule keeps a card valid through the last moment of its month', () => {
    expect(
      isExpired(
        { month: 10, year: 2026 },
        new Date('2026-10-31T23:59:59.999Z'),
      ),
    ).toBe(false);
    expect(
      isExpired(
        { month: 10, year: 2026 },
        new Date('2026-11-01T00:00:00.000Z'),
      ),
    ).toBe(true);
  });

  it('[BR-K3] card rule rolls a December expiry into the next year', () => {
    expect(
      isExpired(
        { month: 12, year: 2026 },
        new Date('2026-12-31T23:59:59.999Z'),
      ),
    ).toBe(false);
    expect(
      isExpired(
        { month: 12, year: 2026 },
        new Date('2027-01-01T00:00:00.000Z'),
      ),
    ).toBe(true);
    expect(
      isExpired({ month: 1, year: 2027 }, new Date('2026-12-31T12:00:00Z')),
    ).toBe(false);
    expect(
      isExpired({ month: 12, year: 2025 }, new Date('2026-01-01T00:00:00Z')),
    ).toBe(true);
  });

  it('[BR-K3] card rule checks expiry against the current time', fakeAsync(() => {
    jasmine.clock().mockDate(new Date('2026-11-01T00:00:00.000Z'));
    expect(checkoutFieldError('expiry', '10/26')).toBe('Your card has expired');
    jasmine.clock().mockDate(new Date('2026-10-31T23:59:59.999Z'));
    expect(checkoutFieldError('expiry', '10/26')).toBeNull();
  }));

  it('[BR-K2] lists the five countries in contract order', () => {
    expect(COUNTRIES).toEqual([
      { code: 'US', name: 'United States' },
      { code: 'CA', name: 'Canada' },
      { code: 'GB', name: 'United Kingdom' },
      { code: 'DE', name: 'Germany' },
      { code: 'NL', name: 'Netherlands' },
    ]);
  });

  it('[BR-K2] the field validator directive reports the rule message', () => {
    const directive = new CheckoutFieldValidatorDirective();
    directive.appCheckoutField = 'cvc';
    expect(directive.validate(new FormControl('12'))).toEqual({
      checkout: 'Enter a valid 3 digit CVC',
    });
    expect(directive.validate(new FormControl(' 123 '))).toBeNull();
    directive.appCheckoutField = 'city';
    expect(directive.validate(new FormControl(''))).toEqual({
      checkout: 'Enter your city',
    });
  });
});
