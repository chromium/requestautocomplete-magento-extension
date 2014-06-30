An extension to integrate `requestAutocomplete()` into Magento's checkout flow!


## API:

### *boolean* `requestAutocomplete.isBrowserSupported()`

Whether the current browser supports `requestAutocomplete()`.


### *boolean* `requestAutocomplete.isMagentoSupported()`

Whether the current Magento environment supports the `rAc()` enhanced checkout flow.


### *boolean* `requestAutocomplete.enable()`

Integrates `requestAutocomplete()` into the Magento checkout flow if supported.
Returns a boolean indicating whether the Magento `rAc()` is enabled.

### `requestAutocomplete.disable()`

Disables the rAc() Magento flow and shows all checkout sections. Does not hide any currently requestAutocomplete() UI.


### *void* `requestAutocomplete.custom(success, opt_failure, opt_billingOnly)`

#### Parameters

**success**:  *function(Object)*,  Callback for successful `rAc()` runs.
**opt_failure**:  *Function=*,  Optional callback for `rAc()` errors.
**opt_billingOnly**:  *boolean=*,  Whether to only ask for billing info. Defaults to false.

A way to manually trigger requestAutocomplete() for custom flows.
Called with a result map of `autocomplete type => value`.
