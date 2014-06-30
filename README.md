An extension to integrate `requestAutocomplete()` into Magento's checkout flow!


### Usage:

To integrate this extension with your Magento store, you can move the files into
your current Magento install.  Here's a way to do this from the command line:

```shell
$ git clone https://github.com/chromium/requestautocomplete-magento-extension.git /tmp/rac-magento-ext/
$ mv -i /tmp/rac-magento-ext/ $MAGENTO_DIR && rm -rf /tmp/rac-magento-ext/
```

This should automatically enable injecting CSS and JavaScript on your checkout flow.

Then, to enable the flow on your page, somewhere in your application JavaScript call:

```js
requestAutocomplete.enable();
```

Which should automatically integrate `requestAutocomplete()` into your checkout flow.
If the extension's working, your shipping, billing, and payment checkout steps should be hidden (because `rAc()` gathers this info for you!).

When the user selects "Checkout as guest" and clicks "Continue", a native browser UI should show asking for their payment/shipping details.

To disable this flow after already being enabled, simply call:

```js
requestAutocomplete.disable();
```

If you'd like to trigger `requestAutocomplete()` in a custom way (e.g. not only on guest checkout), you can do something like this:

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
      // shown in the right way.  The reason parameter can be:
      //   'cancel' => user cancelled
      //   'disabled' => see the development console for more details
      //   'unsupported' => the current browser doesn't support requestAutocomplete()
    },
    false /* change to true if only billing info is needed */);
```


### JavaScript API Docs:

#### *boolean* `requestAutocomplete.isBrowserSupported()`

Whether the current browser supports `requestAutocomplete()`.

--------------------------------------------------------------------------------

#### *boolean* `requestAutocomplete.isMagentoSupported()`

Whether the current Magento environment supports the `rAc()` enhanced checkout
flow.

--------------------------------------------------------------------------------

#### *boolean* `requestAutocomplete.enable()`

Integrates `requestAutocomplete()` into the Magento checkout flow if supported.
Returns a boolean indicating whether the Magento `rAc()` is enabled.

--------------------------------------------------------------------------------

#### `requestAutocomplete.disable()`

Disables the `rAc()` Magento flow and shows all checkout sections. Does not hide
any currently showing `requestAutocomplete()` UI.

--------------------------------------------------------------------------------

#### `requestAutocomplete.custom(success, failure, billingOnly)`

##### Parameters

**success**:  *function(Object)*,  Callback for successful `rAc()` runs.

**failure**:  *Function=*,  An optional callback for `rAc()` errors.

**billingOnly**:  *boolean=*,  Whether to only ask for billing info. Defaults to
false.

A way to manually trigger `requestAutocomplete()` for custom flows.
Called with a result map of `{'autocomplete type': 'value'}`.
