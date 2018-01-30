import FormulateGroup from './components/Formulate'
import FormulateElement from './components/FormulateElement'
import DefaultRules from './rules'
import DefaultErrors from './errors'

class Formulate {
  /**
   * Initialize vue-formulate.
   */
  constructor () {
    this.defaultOptions = {
      registerComponents: true,
      tags: {
        Formulate: 'formulate',
        FormulateElement: 'formulate-element'
      },
      errors: {},
      rules: {},
      vuexModule: false
    }
    this.errors = DefaultErrors
    this.rules = DefaultRules
  }

  /**
   * Install vue-formulate as an instance of Vue.
   * @param {Vue} Vue
   */
  install (Vue, options = {}) {
    Vue.prototype.$formulate = this
    options = Object.assign(this.defaultOptions, options)
    if (options.registerComponents) {
      Vue.component(options.tags.Formulate, FormulateGroup)
      Vue.component(options.tags.FormulateElement, FormulateElement)
    }
    if (options.errors) {
      this.errors = Object.assign(this.errors, options.errors)
    }
    if (options.rules) {
      this.rules = Object.assign(this.rules, options.rules)
    }
    this.options = options
  }

  /**
   * Given a string of rules parse them out to relevant pieces/parts
   * @param {string} rulesString
   */
  parseRules (rulesString) {
    return rulesString.split('|')
      .map(rule => rule.trim())
      .map(rule => rule.match(/([a-zA-Z0-9]+)\((.*)?\)/) || [null, rule, ''])
      .map(([ruleString, rule, args]) => Object.assign({}, {rule}, args ? {
        args: args.split(',').map(arg => arg.trim())
      } : {args: []}))
  }

  /**
   * Return the function that generates a validation error message for a given
   * validation rule.
   * @param {string} rule
   */
  errorFactory (rule) {
    return this.errors[rule] ? this.errors[rule] : this.errors['default']
  }

  /**
   * Recursively find all instance of FormulateElement inside a given vnode.
   */
  fields (vnode) {
    let fields = []
    let children = false
    if (vnode && vnode.componentOptions && vnode.componentOptions.children && vnode.componentOptions.children.length) {
      children = vnode.componentOptions.children
    } else if (vnode && vnode.children && vnode.children.length) {
      children = vnode.children
    }
    if (children) {
      fields = fields.concat(children.reduce((names, child) => {
        if (child.componentOptions && child.componentOptions.tag === this.options.tags.FormulateElement) {
          names.push(child.componentOptions.propsData)
        }
        return names.concat(this.fields(child))
      }, []))
    }
    return fields
  }

  /**
   * Given a particular field, value, validation rules, and form values
   * perform asynchronous field validation.
   * @param {Object} validatee
   * @param {string} rulesString
   * @param {Object} values
   */
  async validationErrors ({field, value}, rulesString, values) {
    return rulesString ? Promise.all(
      this.parseRules(rulesString)
        .map(({rule, args}) => this.rules[rule]({field, value, error: this.errorFactory(rule), values}, ...args))
    ).then(responses => responses.reduce((errors, error) => {
      return error ? (Array.isArray(errors) ? errors.concat(error) : [error]) : errors
    }, false)) : false
  }
}
const formulate = new Formulate()
export default formulate
export * from './store'

/**
 * Mapper to allow  bindings to the vuex store for custom fields.
 * @param {Object} definitions
 */
export const mapModels = (definitions) => {
  const models = {}
  for (let mapTo in definitions) {
    let [form, field] = definitions[mapTo].split('/')
    models[mapTo] = {
      set (value) {
        let m = formulate.options.vuexModule ? `${formulate.options.vuexModule}/` : ''
        this.$store.commit(`${m}setFieldValue`, {form, field, value})
      },
      get () {
        let m = formulate.options.vuexModule ? `${formulate.options.vuexModule}/` : ''
        if (this.$store.getters[`${m}formValues`][form]) {
          return this.$store.getters[`${m}formValues`][form][field]
        }
        return ''
      }
    }
  }
  return models
}