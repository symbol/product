export const validateRequired = () => str => {
    if (str.length === 0) {
        return 'validation_error_field_required';
    }
}

export const validateAccountName = () => str => {
    if (str.length > 15) {
        return 'validation_error_contact_name_long';
    }
}
