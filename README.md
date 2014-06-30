### What

This is an extension to integrate `requestAutocomplete()` into Magento's
checkout flow.

To enable this extension, you must place all the files in this repository into
your existing Magento installation (just like all other extensions).

You can do this via these shell commands if you're on a POSIX system:

```shell
git clone https://github.com/chromium/requestautocomplete-magento-extension.git /tmp/rac-magento-ext/
mv -i /tmp/rac-magento-ext/ $MAGENTO_DIR && rm -rf /tmp/rac-magento-ext/
```

This extension may also be available via Magento Connect in the near future.

### How

#### Integrating into the existing Magento checkout flow

To enable the `rAc()` enhanced checkout flow on your store, you need to add this
JavaScript to your one page checkout:

```js
requestAutocomplete.enable();
```

This should automatically integrate `requestAutocomplete()` into your checkout
flow. Your shipping, billing, and payment checkout steps should now be hidden
(because `rAc()` gathers this info for you, showing these steps aren't
necessary).

When the user selects "Checkout as guest" and clicks "Continue", a native
browser UI should show asking for their payment/shipping details.

#### Creating your own custom `rAc()` flow

If you'd like to trigger `requestAutocomplete()` in a custom way (e.g. not only
on guest checkout), you can do something like this:

```js
requestAutocomplete.custom(
    function(result) {
      // Success! The user gave us their payment info in the form of:
      //   result = {
      //     'cc-name': 'Big Spenda',
      //     'billing postal-code': '90210',
      //     'shipping city': 'Hollywood',
      //     ... and many more ...
      //   }
    },
    function(reason) {
      // Oh no! The user cancelled the requestAutocomplete() UI or it wasn't
      // shown in the right way. The reason parameter can be:
      //   'cancel' => user cancelled
      //   'disabled' => see the development console for more details
      //   'unsupported' => the current browser doesn't support requestAutocomplete()
    },
    false /* change to true if only billing info is needed */);
```

### Docs

#### *boolean* `requestAutocomplete.enable()`

Integrates `requestAutocomplete()` into the Magento checkout flow if supported.
Returns a boolean indicating whether the Magento `rAc()` is enabled.

--------------------------------------------------------------------------------

#### `requestAutocomplete.custom(success, failure, billingOnly)`

##### Parameters

**success**:  *function(Object)*,  Callback for successful `rAc()` runs.

**failure**:  *Function=*,  An optional callback for `rAc()` errors.

**billingOnly**:  *boolean=*,  Whether to only ask for billing info. Defaults to
false.

A way to manually trigger `requestAutocomplete()` for custom flows.
Called with a result map of `{'autocomplete type': 'value'}`.

--------------------------------------------------------------------------------

#### *boolean* `requestAutocomplete.isBrowserSupported()`

Whether the current browser supports `requestAutocomplete()`.

--------------------------------------------------------------------------------

#### *boolean* `requestAutocomplete.isMagentoSupported()`

Whether the current Magento environment supports the `rAc()` enhanced checkout
flow.

--------------------------------------------------------------------------------

#### `requestAutocomplete.disable()`

Disables the `rAc()` Magento flow and unhides all checkout sections. Does not
hide any currently showing `requestAutocomplete()` UI.
