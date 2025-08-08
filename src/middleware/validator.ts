import { Validator as JSONSchemaValidator, ValidationError as JSONSchemaError } from 'jsonschema';
import { Schema, ValidationResult, ValidationError, ValidatorFunction } from './types.js';

export class Validator {
  private jsonValidator: JSONSchemaValidator;
  private customValidators: Map<string, ValidatorFunction>;

  constructor() {
    this.jsonValidator = new JSONSchemaValidator();
    this.customValidators = new Map();
    this.registerBuiltInValidators();
  }

  validateSchema(data: unknown, schema: Schema): ValidationResult {
    const result = this.jsonValidator.validate(data, schema);
    
    if (result.valid) {
      return { valid: true, errors: [] };
    }
    
    const errors: ValidationError[] = result.errors.map((error: JSONSchemaError) => ({
      path: error.property,
      message: error.message,
      value: error.instance,
    }));
    
    return { valid: false, errors };
  }

  validateType(value: unknown, type: string): boolean {
    const typeSchema: Schema = { type };
    const result = this.validateSchema(value, typeSchema);
    return result.valid;
  }

  addValidator(name: string, validator: ValidatorFunction): void {
    this.customValidators.set(name, validator);
  }

  private registerBuiltInValidators(): void {
    // Email validator
    this.addValidator('email', (value, _schema) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (typeof value !== 'string' || !emailRegex.test(value)) {
        return {
          valid: false,
          errors: [{ path: '', message: 'Invalid email format' }],
        };
      }
      return { valid: true, errors: [] };
    });

    // URL validator
    this.addValidator('url', (value, _schema) => {
      try {
        if (typeof value !== 'string') {
          throw new Error('Not a string');
        }
        new URL(value);
        return { valid: true, errors: [] };
      } catch {
        return {
          valid: false,
          errors: [{ path: '', message: 'Invalid URL format' }],
        };
      }
    });

    // UUID validator
    this.addValidator('uuid', (value, _schema) => {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (typeof value !== 'string' || !uuidRegex.test(value)) {
        return {
          valid: false,
          errors: [{ path: '', message: 'Invalid UUID format' }],
        };
      }
      return { valid: true, errors: [] };
    });

    // Date validator
    this.addValidator('date', (value, _schema) => {
      if (typeof value !== 'string' || isNaN(Date.parse(value))) {
        return {
          valid: false,
          errors: [{ path: '', message: 'Invalid date format' }],
        };
      }
      return { valid: true, errors: [] };
    });
  }

  validateWithCustom(data: unknown, schema: Schema, customValidatorName?: string): ValidationResult {
    const baseResult = this.validateSchema(data, schema);
    
    if (!baseResult.valid || !customValidatorName) {
      return baseResult;
    }
    
    const customValidator = this.customValidators.get(customValidatorName);
    if (!customValidator) {
      return baseResult;
    }
    
    return customValidator(data, schema);
  }

  coerceTypes(data: unknown, schema: Schema): unknown {
    if (!schema.type || !data) {
      return data;
    }

    switch (schema.type) {
      case 'number':
        if (typeof data === 'string' && !isNaN(Number(data))) {
          return Number(data);
        }
        break;
      case 'boolean':
        if (typeof data === 'string') {
          if (data === 'true') return true;
          if (data === 'false') return false;
        }
        break;
      case 'string':
        if (typeof data !== 'string') {
          return String(data);
        }
        break;
    }

    return data;
  }
}