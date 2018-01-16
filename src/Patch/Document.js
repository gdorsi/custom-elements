import Native from './Native.js';
import CustomElementInternals from '../CustomElementInternals.js';
import * as Utilities from '../Utilities.js';

import PatchParentNode from './Interface/ParentNode.js';

/**
 * @param {!CustomElementInternals} internals
 */
export default function(internals) {
  function patch_createElement(baseFunction) {
    Utilities.setPropertyUnchecked(Document.prototype, 'createElement',
      /**
       * @this {Document}
       * @param {string} localName
       * @return {!Element}
       */
      function(localName) {
        // Only create custom elements if this document is associated with the registry.
        if (this.__CE_hasRegistry) {
          const definition = internals.localNameToDefinition(localName);
          if (definition) {
            return new (definition.constructor)();
          }
        }

        const result = /** @type {!Element} */
          (baseFunction.call(this, localName));
        internals.patch(result);
        return result;
      });
  };

  // If `document.createElement` is an own property, use it instead of
  // `Document.prototype.createElement` to work around a LastPass bug.
  const singletonDesc = Native.window_document_createElement;
  if (singletonDesc && typeof singletonDesc.value === "function") {
    patch_createElement(singletonDesc.value);
    delete document.createElement;

    console.warn("Custom Elements: " +
      "An own property for `createElement` was found on `document`. This " +
      "function was wrapped instead of `Document.prototype.createElement` " +
      "and the own property was removed. See " +
      "https://github.com/webcomponents/custom-elements/issues/137 for more " +
      "information.");
  } else {
    patch_createElement(Native.Document_createElement);
  }

  Utilities.setPropertyUnchecked(Document.prototype, 'importNode',
    /**
     * @this {Document}
     * @param {!Node} node
     * @param {boolean=} deep
     * @return {!Node}
     */
    function(node, deep) {
      const clone = Native.Document_importNode.call(this, node, deep);
      // Only create custom elements if this document is associated with the registry.
      if (!this.__CE_hasRegistry) {
        internals.patchTree(clone);
      } else {
        internals.patchAndUpgradeTree(clone);
      }
      return clone;
    });

  const NS_HTML = "http://www.w3.org/1999/xhtml";

  Utilities.setPropertyUnchecked(Document.prototype, 'createElementNS',
    /**
     * @this {Document}
     * @param {?string} namespace
     * @param {string} localName
     * @return {!Element}
     */
    function(namespace, localName) {
      // Only create custom elements if this document is associated with the registry.
      if (this.__CE_hasRegistry && (namespace === null || namespace === NS_HTML)) {
        const definition = internals.localNameToDefinition(localName);
        if (definition) {
          return new (definition.constructor)();
        }
      }

      const result = /** @type {!Element} */
        (Native.Document_createElementNS.call(this, namespace, localName));
      internals.patch(result);
      return result;
    });

  PatchParentNode(internals, Document.prototype, {
    prepend: Native.Document_prepend,
    append: Native.Document_append,
  });
};
