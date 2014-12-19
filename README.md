### What

This is an extension to integrate [`requestAutocomplete`](https://developer.chrome.com/multidevice/requestautocomplete-faq) into Magento's
checkout flow.

To enable this extension, copy all directories into the root of your Magento
installation.

You can install with [`modman`](https://github.com/colinmollenhour/modman).  

Alternatively, you can do this via these shell commands if you're on a POSIX system:

```shell
git clone https://github.com/chromium/requestautocomplete-magento-extension.git /tmp/rac-magento-ext/
mv -i /tmp/rac-magento-ext/ $MAGENTO_DIR && rm -rf /tmp/rac-magento-ext/
```

### How

#### Integrating into the existing Magento checkout flow

To enable the `requestAutocomplete` enhanced checkout flow on your store, you
need to add this JavaScript to your one page checkout:

```js
requestAutocomplete.enable();
```

This should automatically integrate `requestAutocomplete` into your checkout
flow. Your shipping, billing, and payment checkout steps should now be hidden,
effectively replaced by the requestAutocomplete dialog.

When the user selects "Checkout as guest" and clicks "Continue", a native
browser UI should show asking for their payment/shipping details.

#### Creating your own custom `requestAutocomplete` flow

If you'd like to trigger `requestAutocomplete` in a custom way (e.g., directly
from the cart page when the user presses "Checkout Now"). The code might look
like this:

```js
function success(result) {
  // Success! The user gave us their payment info in the form of:
  //   result = {
  //     'cc-name': 'Big Spenda',
  //     'billing postal-code': '90210',
  //     'shipping city': 'Hollywood',
  //     ... and many more ...
  //   }
}

function failure(reason) {
  // Oh no! The user cancelled the requestAutocomplete UI or it wasn't
  // shown in the right way. The reason parameter can be:
  //   'cancel' => user cancelled
  //   'disabled' => see the development console for more details
  //   'unsupported' => the current browser doesn't support requestAutocomplete
}

var types = [
  'cc-csc',
  'cc-name',
  'cc-number'
];

requestAutocomplete.run(success, failure, types);
```

### Docs

#### *boolean* `requestAutocomplete.enable()`

Integrates `requestAutocomplete` into the Magento checkout flow if supported.
Returns a boolean indicating whether the Magento `requestAutocomplete` flow is
now enabled. Returns false if the Magento version isn't supported or if the
user's browser doesn't have `requestAutocomplete`.

--------------------------------------------------------------------------------

#### `requestAutocomplete.run(success, failure, types)`

A way to manually trigger `requestAutocomplete` for customized checkout flows.

Parameter|Type|Description
---------|----|-----------
**success**|*function(Object)*|Callback for successful `requestAutocomplete` runs. Receives a result map of autocomplete type => value.
**failure**|*function(string)*|An optional callback for requestAutocomplete` errors. Receives a string reason for the failure (e.g., "cancel").
**types**|*!Array.<string>*|A list of [autocomplete] types to request.

--------------------------------------------------------------------------------

#### *boolean* `requestAutocomplete.isBrowserSupported()`

Whether the current browser supports `requestAutocomplete`.

--------------------------------------------------------------------------------

#### *boolean* `requestAutocomplete.isMagentoSupported()`

Whether the current Magento environment supports the `requestAutocomplete`
enhanced checkout flow. This depends on whether parts of Magento's JavaScript
API are present on the checkout page.

--------------------------------------------------------------------------------

#### `requestAutocomplete.disable()`

Disables the `requestAutocomplete` Magento flow and unhides all checkout
sections. Does not hide any currently showing `requestAutocomplete` UI.
