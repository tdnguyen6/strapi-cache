/**
 * tpol policy
 */

export default (ctx, config, { strapi }) => {
    // Add your own logic here.
    strapi.log.info('In tpol policy.');
    strapi.log.debug('ctx', JSON.stringify(ctx));
    const cache = [];
    console.log(JSON.stringify(ctx,function(key, value) {
        if (typeof value === 'object' && value !== null) {
            if (cache.indexOf(value) !== -1) {
                // Circular reference found, discard key
                return;
            }
            // Store value in our collection
            cache.push(value);
        }
        return value;
    }))
    strapi.log.debug('cfg', JSON.stringify(config));
    console.log(JSON.stringify(config));

    const canDoSomething = true;

    if (canDoSomething) {
      return true;
    }

    return false;
};
